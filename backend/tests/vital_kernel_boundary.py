"""vital_kernel_boundary.py — THE KERNEL/APP BOUNDARY (kernel extraction, 2026-07-22). Pure AST, no DB.

The kernel = the generic employee nervous system; the app = Rocoto's commerce world. A kernel module
importing an app module is a boundary breach — the class of debt that makes a runtime a pile of
workflows. This vital PROVES the hierarchy: every kernel module's imports resolve inside the kernel
set (+ stdlib/3rd-party). App→kernel is fine (apps build ON the kernel); kernel→app is the failure.
"""
import ast
import os
import sys

KERNEL = {
    "spine", "memory", "assemble", "gate", "lifecycle", "soul", "cascade", "duties", "presence",
    "presence_call", "voice_fabric", "voice_protocol", "triggers", "tenancy", "directory", "learn",
    "confidence", "runtime", "db", "config", "rt_embed", "sweep", "reach", "install", "wake",
    # per-tenant behaviour settings (§17.46/§17.51's `S`). Kernel because the RUNTIME reads it on
    # every turn and it imports nothing but config + db — the same shape as `tenancy`. It lived in
    # brain/ for one commit and this vital caught the kernel→app edge immediately.
    "behaviour",
}
APP = {
    "orders_tool", "orders", "rocoto_processes", "demo_call", "el_convai", "eleven", "brain",
    "medusa", "agent_chat", "control_room", "cr_session", "cr_control", "app", "voice_reply", "agent_reply",
    "projector", "employment", "postcall", "voice", "voice_turn", "voice_toggle",
}

# THE RATCHET (strangler pattern): these 5 edges are KNOWN, NAMED debt from before the extraction —
# each is a real refactor (move the primitive kernel-side), tracked here so the count can only go DOWN.
# The vital's job from today: NO NEW kernel→app edge, ever.
ALLOWED_LEGACY = {
    ("learn", "agent_reply"),      # _do_open_tab: the tab-opening actuator belongs in kernel agency
    ("runtime", "agent_reply"),    # the R1 mind entry (_run_mind) — mind is kernel; module is mixed
    ("runtime", "voice_reply"),    # sanitizer/voice rail — split the kernel sanitizer out
    ("runtime", "demo_call"),      # place_call actuator — belongs behind a manifest tool
    ("sweep", "brain"),            # summary sweep touches the commerce brain — invert via an event
}

bad = []
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for mod in sorted(KERNEL):
    path = os.path.join(here, mod + ".py")
    if not os.path.exists(path):
        continue
    tree = ast.parse(open(path).read())
    for node in ast.walk(tree):
        names = []
        if isinstance(node, ast.Import):
            names = [a.name.split(".")[0] for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            names = [node.module.split(".")[0]]
        for n in names:
            if n in APP and (mod, n) not in ALLOWED_LEGACY:
                bad.append(f"{mod}.py imports {n} (NEW kernel→app breach)")

n_checked = len([m for m in KERNEL if os.path.exists(os.path.join(here, m + '.py'))])
for b in bad:
    print(f"  [FAIL] {b}")
if bad:
    print(f"\nKERNEL BOUNDARY: {len(bad)} breach(es) in {n_checked} kernel modules")
    sys.exit(1)
print(f"KERNEL BOUNDARY: {n_checked} kernel modules, 0 NEW breaches ({len(ALLOWED_LEGACY)} named legacy edges ratcheted) — the hierarchy HOLDS")
