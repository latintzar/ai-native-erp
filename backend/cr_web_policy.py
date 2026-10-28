"""Browser policy shared by the existing Control Room and playbook shells."""

_CR_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; img-src 'self' data:; "
    "connect-src 'self' https://zvgifcabohnlogpzzowa.supabase.co; "
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
)
_CR_SEC_HEADERS = {
    "Content-Security-Policy": _CR_CSP,
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
}
