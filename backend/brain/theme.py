"""The design-shotgun theme generator (ecommerce-manager.md §8) — Opus 4.8 builds the storefront FOR
the supplier within the section-kit + token guardrails. It emits a DATA-ONLY page-model (sections[] +
brandTokens + copy) via a forced tool call (structured output), NOT free-form HTML — the storefront's
fixed React section-kit renders it (XSS-safe by construction). A re-run is seeded with prior reactions
so the owner tweaks rather than restarts.

The output is the SAME page-model contract the storefront's lib/pageModel.ts validates and renders; the
storefront re-validates everything (allowlist tokens, escaped strings) so a bad generation can never
produce unsafe output. This module just authors a tasteful candidate.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import anthropic

import config

MODEL = config.AGENT_CHAT_MODEL  # claude-opus-4-8

# The fixed section-kit + token enums (must mirror the storefront's lib/pageModel.ts + brandTokens.ts).
SECTION_TYPES = ["hero", "trustBar", "productGrid", "story", "cta", "customCapture", "footer"]
FONT_ENUM = ["system", "grotesk", "serif", "rounded", "mono"]

PAGE_MODEL_TOOL = {
    "name": "emit_page_model",
    "description": "Emit the storefront page-model: brand tokens + an ordered list of sections + copy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "brandTokens": {
                "type": "object",
                "properties": {
                    "primary": {"type": "string", "description": "brand accent hex, e.g. #C95216"},
                    "primaryDeep": {"type": "string", "description": "darker shade hex"},
                    "ink": {"type": "string", "description": "body text hex (dark, high contrast on paper)"},
                    "paper": {"type": "string", "description": "page background hex (light)"},
                    "paperAlt": {"type": "string", "description": "section-alt background hex"},
                    "muted": {"type": "string", "description": "secondary text hex"},
                    "font": {"type": "string", "enum": FONT_ENUM},
                    "radius": {"type": "integer", "description": "corner radius px 0-28"},
                },
                "required": ["primary", "primaryDeep", "ink", "paper", "paperAlt", "muted", "font", "radius"],
            },
            "copy": {
                "type": "object",
                "properties": {
                    "siteName": {"type": "string"},
                    "tagline": {"type": "string"},
                },
                "required": ["siteName"],
            },
            "sections": {
                "type": "array",
                "description": "ordered sections; start with hero, include exactly one productGrid, end with footer",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": SECTION_TYPES},
                        "eyebrow": {"type": "string"},
                        "heading": {"type": "string"},
                        "sub": {"type": "string"},
                        "ctaLabel": {"type": "string"},
                        "ctaHref": {"type": "string"},
                        "items": {"type": "array", "items": {"type": "string"}},
                        "body": {"type": "string"},
                        "limit": {"type": "integer"},
                        "whatsapp": {"type": "string"},
                        "business": {"type": "string"},
                        "lines": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["type"],
                },
            },
        },
        "required": ["brandTokens", "copy", "sections"],
    },
}

SYSTEM = (
    "You design mobile-first e-commerce storefronts for small Spanish food producers (charcutería, "
    "bakeries, cheesemongers) who sell to bars and restaurants. The shop must feel warm, artisanal, "
    "trustworthy and APP-LIKE — most buyers order from a phone. Copy is in Spanish. You ONLY emit a "
    "page-model via the emit_page_model tool: brand tokens (real hex, high text contrast), tasteful "
    "Spanish copy, and an ordered section list (hero → trustBar → productGrid → story → customCapture "
    "→ cta → footer is a good spine; vary it). Never write HTML. Keep it honest — no fake reviews, no "
    "invented awards."
)


def _build_prompt(brand_hint: str, inspiration: str, reactions: List[str], variant_seed: int) -> str:
    parts = [
        f"Design storefront variant #{variant_seed} for: {brand_hint or 'Sancho Cured Meats, an artisan cured-meats maker in Alcalá de Henares delivering to local bars'}.",
    ]
    if inspiration:
        parts.append(f"The owner likes this site's vibe (clone the FEEL, never the layout): {inspiration}")
    if reactions:
        parts.append("Prior reactions to fold in (tweak toward these, don't restart):\n- " + "\n- ".join(reactions[:8]))
    parts.append(
        f"Make variant #{variant_seed} DELIBERATELY DISTINCT from the others in palette + tone "
        "(e.g. saffron-warm, deep-claret-elegant, fresh-green-market, charcoal-modern). Emit the page-model now."
    )
    return "\n\n".join(parts)


def _generate_sync(brand_hint: str, inspiration: str, reactions: List[str], variant_seed: int) -> Dict[str, Any]:
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=60.0)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        tools=[PAGE_MODEL_TOOL],
        tool_choice={"type": "tool", "name": "emit_page_model"},
        messages=[{"role": "user", "content": _build_prompt(brand_hint, inspiration, reactions, variant_seed)}],
    )
    for block in msg.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "emit_page_model":
            return dict(block.input)
    raise RuntimeError("model did not emit a page-model")


async def generate_page_model(
    brand_hint: str = "",
    inspiration: str = "",
    reactions: Optional[List[str]] = None,
    variant_seed: int = 1,
) -> Dict[str, Any]:
    """Author a storefront page-model candidate (the storefront re-validates it before render)."""
    if not config.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY unset")
    return await asyncio.to_thread(_generate_sync, brand_hint, inspiration, reactions or [], variant_seed)
