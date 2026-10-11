import re
PRON = {"four-fifths": "four fifths", "needle-drop": "needle drop", "worn-out": "worn out", "'round": "round",
        "lopsided": "lop sided", "Vilfredo": "vilfredo", "Pareto,": "pareto", "Pareto": "pareto"}
def pron(token):
    key = token.replace("’", "'")
    if key in PRON: return PRON[key].split()
    w = key.lower()
    w = re.sub(r"[^a-z' ]", " ", w).strip("' ")
    return [p.strip("'") for p in w.split() if p.strip("'")]
