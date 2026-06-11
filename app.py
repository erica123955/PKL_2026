from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import math, json, os
from collections import Counter

app = Flask(__name__)

# ============================================================
# LOAD BASE DATA
# ============================================================
DATA_PATH = "data.xlsx"

df_nov = pd.read_excel(DATA_PATH, sheet_name="NOV_C45_TRAINING")
df_des = pd.read_excel(DATA_PATH, sheet_name="DES_C45_TRAINING")
df_jan = pd.read_excel(DATA_PATH, sheet_name="JAN_C45_TRAINING")
df_summary = pd.read_excel(DATA_PATH, sheet_name="RINGKASAN_3_BULAN")

FEATURES = ["DPD_KAT","TUNGGAKAN_KAT","ANGSURAN_KAT","RATE_KAT","BAYAR_BELUM","KELOLAAN_KAT"]
TARGET   = "EWS"

# Base months (read-only Excel sheets)
MONTH_MAP = {"NOV": df_nov, "DES": df_des, "JAN": df_jan}
MONTH_LABEL = {
    "NOV": "November 2025",
    "DES": "Desember 2025",
    "JAN": "Januari 2026"
}

# Dynamic storage: base months + any custom months
extra_rows   = {k: [] for k in MONTH_MAP}   # extra rows for base months
custom_months = {}   # key -> {"label": str, "rows": []}
# custom_months rows are the entire data for that month

models = {}

# ============================================================
# ID3
# ============================================================
class ID3Node:
    def __init__(self):
        self.feature=None; self.label=None; self.children={}
        self.is_leaf=False; self.entropy=0; self.samples=0; self.distribution={}

class ID3Tree:
    def __init__(self, max_depth=6):
        self.root=None; self.max_depth=max_depth
        self.feature_importance={}; self.build_log=[]

    def calc_entropy(self, labels):
        total = len(labels)
        if total == 0: return 0
        counts = Counter(labels)
        return -sum((c/total)*math.log2(c/total) for c in counts.values() if c>0)

    def calc_information_gain(self, df, feature, target):
        base_ent = self.calc_entropy(df[target])
        total    = len(df)
        w_ent    = sum((len(s)/total)*self.calc_entropy(s[target])
                       for v in df[feature].unique()
                       for s in [df[df[feature]==v]])
        return base_ent - w_ent

    def select_best_feature(self, df, features, target):
        gains = {f: self.calc_information_gain(df,f,target) for f in features}
        best  = max(gains, key=gains.get)
        return best, gains

    def build_tree(self, df, features, target, depth=0):
        node = ID3Node()
        node.samples = len(df)
        node.entropy = self.calc_entropy(df[target])
        node.distribution = dict(Counter(df[target]))
        majority = Counter(df[target]).most_common(1)[0][0]

        if len(df[target].unique()) == 1:
            node.is_leaf=True; node.label=df[target].iloc[0]; return node
        if not features or depth >= self.max_depth:
            node.is_leaf=True; node.label=majority; return node

        best, gains = self.select_best_feature(df, features, target)
        node.feature = best
        self.build_log.append({"depth":depth,"feature":best,
            "gain":round(gains[best],6),"samples":len(df),"entropy":round(node.entropy,6)})
        self.feature_importance[best] = self.feature_importance.get(best,0) + gains[best]

        remaining = [f for f in features if f != best]
        for val in df[best].unique():
            subset = df[df[best]==val]
            if len(subset)==0:
                leaf=ID3Node(); leaf.is_leaf=True; leaf.label=majority; leaf.samples=0
                node.children[val]=leaf
            else:
                node.children[val]=self.build_tree(subset, remaining, target, depth+1)
        return node

    def fit(self, df, features, target):
        self.feature_importance={}; self.build_log=[]
        self.root = self.build_tree(df, features, target)
        total = sum(self.feature_importance.values())
        if total > 0:
            for k in self.feature_importance:
                self.feature_importance[k] = round(self.feature_importance[k]/total*100, 2)

    def predict_single(self, row, node):
        if node.is_leaf: return node.label
        val = row.get(node.feature)
        if val in node.children: return self.predict_single(row, node.children[val])
        return max(node.distribution, key=node.distribution.get) if node.distribution else "HIJAU"

    def predict_all(self, df):
        return [self.predict_single(r.to_dict(), self.root) for _,r in df.iterrows()]

    def get_accuracy(self, df, target):
        preds   = self.predict_all(df)
        correct = sum(p==a for p,a in zip(preds, df[target]))
        return round(correct/len(df)*100, 2)

    def get_confusion(self, df, target):
        preds   = self.predict_all(df)
        labels  = ["HIJAU","KUNING","MERAH"]
        matrix  = {a:{p:0 for p in labels} for a in labels}
        for pred, actual in zip(preds, df[target]):
            if actual in matrix and pred in matrix[actual]:
                matrix[actual][pred] += 1
        return matrix

    def node_to_dict(self, node, depth=0):
        if node is None: return {}
        d = {"feature":node.feature,"label":node.label,"is_leaf":node.is_leaf,
             "samples":node.samples,"entropy":round(node.entropy,4),
             "distribution":node.distribution,"depth":depth,"children":{}}
        for val, child in node.children.items():
            d["children"][str(val)] = self.node_to_dict(child, depth+1)
        return d

# ============================================================
# HELPERS
# ============================================================
def all_month_keys():
    return list(MONTH_MAP.keys()) + list(custom_months.keys())

def get_combined_df(month_key):
    if month_key in MONTH_MAP:
        base   = MONTH_MAP[month_key].copy()
        extras = extra_rows.get(month_key, [])
        if extras:
            return pd.concat([base, pd.DataFrame(extras)], ignore_index=True)
        return base
    if month_key in custom_months:
        rows = custom_months[month_key]["rows"]
        if rows:
            return pd.DataFrame(rows)
    return pd.DataFrame(columns=FEATURES+[TARGET])

def get_label(month_key):
    if month_key in MONTH_LABEL: return MONTH_LABEL[month_key]
    if month_key in custom_months: return custom_months[month_key]["label"]
    return month_key

def train_month(month_key):
    df = get_combined_df(month_key)
    if len(df) == 0: return
    tree_model = ID3Tree(max_depth=6)
    tree_model.fit(df, FEATURES, TARGET)
    acc = tree_model.get_accuracy(df, TARGET)
    models[month_key] = {"tree": tree_model, "accuracy": acc}

def count_nodes(node):
    if node is None: return 0
    return 1 + sum(count_nodes(c) for c in node.children.values())

def get_depth(node):
    if node is None or node.is_leaf: return 0
    return 1 + max((get_depth(c) for c in node.children.values()), default=0)

for k in MONTH_MAP:
    train_month(k)

# ============================================================
# ROUTES
# ============================================================
@app.route("/")
def index():
    stats = {}
    for mk in all_month_keys():
        df = get_combined_df(mk)
        if len(df) == 0: continue
        dist  = dict(Counter(df[TARGET]))
        total = len(df)
        stats[mk] = {
            "label":      get_label(mk),
            "total":      total,
            "hijau":      dist.get("HIJAU",0),
            "kuning":     dist.get("KUNING",0),
            "merah":      dist.get("MERAH",0),
            "pct_hijau":  round(dist.get("HIJAU",0)/total*100,1),
            "pct_kuning": round(dist.get("KUNING",0)/total*100,1),
            "pct_merah":  round(dist.get("MERAH",0)/total*100,1),
            "accuracy":   models.get(mk,{}).get("accuracy",0)
        }
    summary_rows = [r.to_dict() for _,r in df_summary.iterrows()]
    return render_template("index.html", stats=stats, summary=summary_rows,
                           all_months=all_month_keys(),
                           month_labels={k:get_label(k) for k in all_month_keys()})

@app.route("/months")
def get_months():
    return jsonify({
        k: {"label": get_label(k), "total": len(get_combined_df(k))}
        for k in all_month_keys()
    })

@app.route("/predict", methods=["POST"])
def predict():
    data     = request.json
    mk       = data.get("month","NOV")
    feats    = {f: data.get(f) for f in FEATURES}
    if mk not in models:
        return jsonify({"error":"Model belum tersedia untuk bulan ini"}), 400
    tree  = models[mk]["tree"]
    pred  = tree.predict_single(feats, tree.root)
    cmap  = {"HIJAU":"#22c55e","KUNING":"#eab308","MERAH":"#ef4444"}
    imap  = {"HIJAU":"✅","KUNING":"⚠️","MERAH":"🔴"}
    amap  = {"HIJAU":"Debitur AMAN — tidak ada tindakan khusus.",
             "KUNING":"Debitur WASPADA — lakukan monitoring dan deskcall.",
             "MERAH":"Debitur BERBAHAYA — eskalasi segera ke kantor cabang."}
    return jsonify({"status":"success","result":pred,"color":cmap.get(pred,"#6b7280"),
                    "icon":imap.get(pred,""),"action":amap.get(pred,""),
                    "month":get_label(mk)})

@app.route("/analysis/<month_key>")
def analysis(month_key):
    if month_key not in models:
        return jsonify({"error":"Bulan tidak valid"}), 404
    df    = get_combined_df(month_key)
    tree  = models[month_key]["tree"]
    dist  = dict(Counter(df[TARGET]))
    total = len(df)
    ig    = {f: round(tree.calc_information_gain(df,f,TARGET),6) for f in FEATURES}
    return jsonify({
        "month": get_label(month_key), "total": total,
        "distribution": {"HIJAU":dist.get("HIJAU",0),"KUNING":dist.get("KUNING",0),"MERAH":dist.get("MERAH",0)},
        "pct": {"HIJAU":round(dist.get("HIJAU",0)/total*100,1),
                "KUNING":round(dist.get("KUNING",0)/total*100,1),
                "MERAH":round(dist.get("MERAH",0)/total*100,1)},
        "accuracy": tree.get_accuracy(df, TARGET),
        "total_entropy": round(tree.calc_entropy(df[TARGET]),6),
        "information_gain": ig,
        "feature_importance": tree.feature_importance,
        "build_log": tree.build_log[:15]
    })

@app.route("/accuracy/<month_key>")
def accuracy_detail(month_key):
    """Detail akurasi: confusion matrix, per-class metrics, build steps."""
    if month_key not in models:
        return jsonify({"error":"Bulan tidak valid"}), 404
    df    = get_combined_df(month_key)
    tree  = models[month_key]["tree"]
    labels= ["HIJAU","KUNING","MERAH"]

    preds   = tree.predict_all(df)
    actuals = df[TARGET].tolist()
    total   = len(df)
    correct = sum(p==a for p,a in zip(preds,actuals))
    acc     = round(correct/total*100, 2)

    # Confusion matrix
    matrix = {a:{p:0 for p in labels} for a in labels}
    for p,a in zip(preds,actuals):
        if a in matrix and p in matrix[a]: matrix[a][p] += 1

    # Per-class precision / recall / f1
    per_class = {}
    for cls in labels:
        tp = matrix[cls][cls]
        fp = sum(matrix[a][cls] for a in labels if a!=cls)
        fn = sum(matrix[cls][p] for p in labels if p!=cls)
        prec = round(tp/(tp+fp)*100,2) if (tp+fp)>0 else 0
        rec  = round(tp/(tp+fn)*100,2) if (tp+fn)>0 else 0
        f1   = round(2*prec*rec/(prec+rec),2) if (prec+rec)>0 else 0
        per_class[cls] = {"tp":tp,"fp":fp,"fn":fn,"precision":prec,"recall":rec,"f1":f1,
                           "support": sum(matrix[cls].values())}

    # Node / depth stats
    n_nodes = count_nodes(tree.root)
    n_depth = get_depth(tree.root)
    n_leaves= sum(1 for n in _iter_nodes(tree.root) if n.is_leaf)

    # Build steps (full log)
    build_steps = tree.build_log

    # Feature importance sorted
    fi_sorted = sorted(tree.feature_importance.items(), key=lambda x:-x[1])

    return jsonify({
        "month":        get_label(month_key),
        "total":        total,
        "correct":      correct,
        "wrong":        total-correct,
        "accuracy":     acc,
        "confusion":    matrix,
        "per_class":    per_class,
        "n_nodes":      n_nodes,
        "n_leaves":     n_leaves,
        "n_depth":      n_depth,
        "build_steps":  build_steps,
        "feature_importance": fi_sorted,
        "total_entropy": round(tree.calc_entropy(df[TARGET]),6),
        "ig": {f: round(tree.calc_information_gain(df,f,TARGET),6) for f in FEATURES},
    })

def _iter_nodes(node):
    if node is None: return
    yield node
    for c in node.children.values(): yield from _iter_nodes(c)

@app.route("/tree/<month_key>")
def get_tree(month_key):
    if month_key not in models: return jsonify({"error":"Bulan tidak valid"}),404
    return jsonify(models[month_key]["tree"].node_to_dict(models[month_key]["tree"].root))

@app.route("/compare")
def compare():
    result = {}
    for mk in all_month_keys():
        if mk not in models: continue
        df   = get_combined_df(mk)
        tree = models[mk]["tree"]
        dist = dict(Counter(df[TARGET]))
        total= len(df)
        ig   = {f:round(tree.calc_information_gain(df,f,TARGET),6) for f in FEATURES}
        result[mk] = {"label":get_label(mk),"total":total,"distribution":dist,
                      "accuracy":models[mk]["accuracy"],"information_gain":ig,
                      "feature_importance":tree.feature_importance}
    return jsonify(result)

@app.route("/add_manual", methods=["POST"])
def add_manual():
    data = request.json
    mk   = data.get("month","NOV")
    # Support custom month
    label = data.get("month_label","").strip()
    if mk not in MONTH_MAP and mk not in custom_months:
        if not label: label = mk
        custom_months[mk] = {"label": label, "rows": []}
        extra_rows[mk]    = []
    row = {f: data.get(f) for f in FEATURES}
    row[TARGET] = data.get(TARGET, "HIJAU")
    if mk in MONTH_MAP:
        extra_rows[mk].append(row)
    else:
        custom_months[mk]["rows"].append(row)
    train_month(mk)
    df   = get_combined_df(mk)
    dist = dict(Counter(df[TARGET]))
    return jsonify({"status":"ok","message":f"Debitur ditambahkan ke {get_label(mk)}",
                    "total":len(df),"distribution":dist,
                    "accuracy":models[mk]["accuracy"],"label":get_label(mk)})

@app.route("/upload_excel", methods=["POST"])
def upload_excel():
    if "file" not in request.files: return jsonify({"error":"Tidak ada file"}),400
    f   = request.files["file"]
    mk  = request.form.get("month","NOV")
    label = request.form.get("month_label","").strip()
    if mk not in MONTH_MAP and mk not in custom_months:
        if not label: label = mk
        custom_months[mk] = {"label": label, "rows": []}
        extra_rows[mk]    = []
    try:
        tmp = f"/tmp/upload_{mk}.xlsx"
        f.save(tmp)
        new_df = pd.read_excel(tmp)
        missing = [c for c in FEATURES+[TARGET] if c not in new_df.columns]
        if missing: return jsonify({"error":f"Kolom kurang: {missing}"}),400
        rows = [{c:row[c] for c in FEATURES+[TARGET]} for _,row in new_df.iterrows()]
        if mk in MONTH_MAP:
            extra_rows[mk].extend(rows)
        else:
            custom_months[mk]["rows"].extend(rows)
        train_month(mk)
        df   = get_combined_df(mk)
        dist = dict(Counter(df[TARGET]))
        return jsonify({"status":"ok","message":f"{len(new_df)} baris ditambahkan ke {get_label(mk)}",
                        "total":len(df),"distribution":dist,
                        "accuracy":models[mk]["accuracy"],"label":get_label(mk)})
    except Exception as e:
        return jsonify({"error":str(e)}),500

@app.route("/reset_extra", methods=["POST"])
def reset_extra():
    mk = request.json.get("month")
    if mk in MONTH_MAP:
        extra_rows[mk] = []
        train_month(mk)
        return jsonify({"status":"ok","message":f"Data tambahan {get_label(mk)} dihapus"})
    if mk in custom_months:
        del custom_months[mk]
        if mk in models: del models[mk]
        return jsonify({"status":"ok","message":f"Bulan {mk} dihapus seluruhnya"})
    return jsonify({"error":"Bulan tidak valid"}),400

if __name__ == "__main__":
    app.run(debug=True, port=5000)
