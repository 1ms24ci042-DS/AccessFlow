"""
AccessFlow Bengaluru — Alerts Module
Generates emergency alerts and BBMP complaint drafts using Gemini AI.
Falls back to template-based generation if the API is unavailable.
"""

import os
from datetime import datetime

# ---------------------------------------------------------------------------
# Try to import Gemini — graceful fallback if key not set
# ---------------------------------------------------------------------------
_gemini_model = None

try:
    import google.generativeai as genai

    _api_key = os.environ.get("GEMINI_API_KEY", "")
    if _api_key:
        genai.configure(api_key=_api_key)
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash")
except Exception:
    pass


def _ask_gemini(prompt: str) -> str | None:
    """Send a prompt to Gemini and return the text response, or None."""
    if _gemini_model is None:
        return None
    try:
        response = _gemini_model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Emergency Alert
# ---------------------------------------------------------------------------

def generate_emergency_alert(
    location: str,
    incident_type: str,
    severity: str,
    description: str = "",
) -> dict:
    """
    Generate an emergency alert message for the given incident.
    Uses Gemini if available, otherwise returns a structured template.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    prompt = (
        f"You are an emergency alert system for Bengaluru city traffic.\n"
        f"Generate a concise, professional emergency alert message for:\n"
        f"- Location: {location}\n"
        f"- Incident Type: {incident_type}\n"
        f"- Severity: {severity}\n"
        f"- Description: {description or 'Not available'}\n"
        f"- Timestamp: {now}\n\n"
        f"Include:\n"
        f"1. A clear headline\n"
        f"2. What happened\n"
        f"3. Affected area / roads\n"
        f"4. Suggested action for commuters\n"
        f"5. Emergency contact numbers (use Bengaluru police: 100, ambulance: 108, "
        f"fire: 101, BBMP: 080-22660000)\n\n"
        f"Keep it under 200 words. Use plain text, no markdown."
    )

    ai_text = _ask_gemini(prompt)

    if ai_text:
        return {
            "alert_id": f"ALT-{int(datetime.now().timestamp())}",
            "location": location,
            "type": incident_type,
            "severity": severity,
            "timestamp": now,
            "message": ai_text,
            "generated_by": "gemini",
        }

    # ---- Fallback template ------------------------------------------------
    fallback_msg = (
        f"⚠️ EMERGENCY ALERT — {severity} SEVERITY\n\n"
        f"Incident: {incident_type} at {location}\n"
        f"Time: {now}\n"
        f"Details: {description or 'A ' + incident_type.lower() + ' has been reported at ' + location + '.'}\n\n"
        f"COMMUTER ADVISORY:\n"
        f"• Avoid {location} and surrounding roads.\n"
        f"• Use alternate routes via nearby arterial roads.\n"
        f"• Follow traffic police instructions on-ground.\n\n"
        f"EMERGENCY CONTACTS:\n"
        f"• Police: 100\n"
        f"• Ambulance: 108\n"
        f"• Fire: 101\n"
        f"• BBMP Helpline: 080-22660000\n"
    )

    return {
        "alert_id": f"ALT-{int(datetime.now().timestamp())}",
        "location": location,
        "type": incident_type,
        "severity": severity,
        "timestamp": now,
        "message": fallback_msg,
        "generated_by": "template",
    }


# ---------------------------------------------------------------------------
# BBMP Complaint
# ---------------------------------------------------------------------------

def generate_bbmp_complaint(
    location: str,
    incident_type: str,
    description: str = "",
    accessibility_issue: bool = True,
) -> dict:
    """
    Generate a BBMP (Bruhat Bengaluru Mahanagara Palike) complaint draft
    for infrastructure / accessibility issues.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    prompt = (
        f"You are a civic complaint generation system for Bengaluru.\n"
        f"Draft a formal BBMP complaint for:\n"
        f"- Location: {location}\n"
        f"- Issue Type: {incident_type}\n"
        f"- Description: {description or 'Not provided'}\n"
        f"- Accessibility Concern: {'Yes — affects differently-abled citizens' if accessibility_issue else 'No'}\n"
        f"- Date: {now}\n\n"
        f"Include:\n"
        f"1. Subject line\n"
        f"2. Formal salutation to BBMP Commissioner\n"
        f"3. Clear description of the problem\n"
        f"4. Impact on citizens, especially those with disabilities\n"
        f"5. Requested action\n"
        f"6. Formal closing\n\n"
        f"Keep it professional and under 250 words. Use plain text, no markdown."
    )

    ai_text = _ask_gemini(prompt)

    if ai_text:
        return {
            "complaint_id": f"BBMP-{int(datetime.now().timestamp())}",
            "location": location,
            "type": incident_type,
            "timestamp": now,
            "complaint_text": ai_text,
            "accessibility_flagged": accessibility_issue,
            "generated_by": "gemini",
        }

    # ---- Fallback template ------------------------------------------------
    issue_map = {
        "ACCIDENT": "road safety hazard and damaged infrastructure",
        "FLOOD": "waterlogging and inadequate drainage",
        "BLOCKED": "blocked footpath / road obstruction",
        "CONGESTION": "chronic traffic congestion requiring infrastructure review",
    }
    issue_desc = issue_map.get(incident_type, "civic infrastructure issue")

    fallback_text = (
        f"Subject: Complaint Regarding {incident_type.title()} at {location}\n\n"
        f"To,\nThe Commissioner,\n"
        f"Bruhat Bengaluru Mahanagara Palike (BBMP)\n"
        f"Bengaluru, Karnataka\n\n"
        f"Respected Sir/Madam,\n\n"
        f"I am writing to bring to your attention a {issue_desc} "
        f"at {location}, Bengaluru, observed on {now}.\n\n"
        f"{description or 'The issue poses a significant inconvenience and safety risk to commuters.'}\n\n"
    )

    if accessibility_issue:
        fallback_text += (
            f"This issue severely impacts differently-abled citizens, including "
            f"wheelchair users and visually impaired pedestrians, who depend on "
            f"accessible pathways for safe navigation.\n\n"
        )

    fallback_text += (
        f"I kindly request BBMP to:\n"
        f"1. Inspect the location at the earliest.\n"
        f"2. Take corrective action to resolve the issue.\n"
        f"3. Ensure accessibility compliance as per RPwD Act, 2016.\n\n"
        f"Thank you for your prompt attention.\n\n"
        f"Yours faithfully,\n"
        f"AccessFlow Bengaluru (Automated Report)\n"
        f"Ref: BBMP-{int(datetime.now().timestamp())}"
    )

    return {
        "complaint_id": f"BBMP-{int(datetime.now().timestamp())}",
        "location": location,
        "type": incident_type,
        "timestamp": now,
        "complaint_text": fallback_text,
        "accessibility_flagged": accessibility_issue,
        "generated_by": "template",
    }
