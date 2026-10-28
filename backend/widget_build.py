"""Live in-call UI builder — turns a one-line spec into a self-contained HTML preview.

When the voice agent calls its `build_ui` client tool mid-call, the app hits this: we ask a fast model
to render a single, beautiful, on-brand mobile screen for the described feature, and show it live in the
call window so the owner can react to it while still talking (Peter's co-design moment).
"""
from __future__ import annotations

import asyncio

import anthropic

import config

# Opus 4.8: the real interface-builder — best design judgement (Peter). It's worth the few extra seconds.
WIDGET_MODEL = "claude-opus-4-8"

SYSTEM = """You are the INTERFACE BUILDER for Rocoto — an AI-employees app for a small Spanish food
producer-distributor. Generate ONE complete, beautiful MOBILE PHONE SCREEN as a self-contained HTML
fragment. Output ONLY raw HTML (a root <div> with an inline <style> scoped under it). NO markdown, NO code
fences, NO <html>/<head>/<body>, NO external CSS/JS/fonts/images, NO JS.

The screen is shown in a real phone frame at 390px wide — design it to FILL a phone screen top to bottom:
a clear screen title/header at the top, the main content, and ideally a bottom tab bar so it reads as a
finished app (not a fragment). Use the whole width.

Design system EXACTLY:
- page background #FAF7F3; cards #FFFFFF, 1px solid rgba(26,20,19,0.14), 14px radius, shadow 0 2px 10px rgba(26,20,19,0.06)
- primary Rocoto Red #C01B2C (cream #FAF7F3 text on it); ink #1A1413; muted #6F665C; faint #998F83
- success Huerta green #2E6038 / soft green bg #E7F1E6; CAUTION/error yellow #8A5300 / soft yellow bg #FDF1D6 (red is now the brand, never error)
- font: -apple-system, system-ui, sans-serif; base 15px; section labels 11px uppercase letter-spacing .04em #877A66
- generous 16px padding, rounded pills (999px), clear hierarchy, BIG tabular numbers for data
Make it a REAL, finished, premium screen for the exact feature the owner described — realistic Spanish-SMB
content (real names, € amounts, products like jamón/chorizo/lomo/morcilla), NEVER lorem, never empty. It
should look hand-designed and specific to what they asked for, full and refreshing — not a generic stub."""


async def build(agent: str, spec: str) -> str:
    if not config.ANTHROPIC_API_KEY:
        return "<div style='padding:24px;font-family:system-ui;color:#655A4C'>Preview unavailable.</div>"
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=45.0)

    def _call():
        return client.messages.create(
            model=WIDGET_MODEL,
            max_tokens=2400,
            system=SYSTEM,
            messages=[{"role": "user", "content": f"Agent: {agent}. Preview this screen: {spec}"}],
        )

    resp = await asyncio.to_thread(_call)
    html = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text").strip()
    if html.startswith("```"):
        html = html.strip("`").lstrip()
        if html[:4].lower() == "html":
            html = html[4:]
        html = html.strip()
    return html or "<div style='padding:24px;font-family:system-ui;color:#655A4C'>Couldn't build that preview.</div>"
