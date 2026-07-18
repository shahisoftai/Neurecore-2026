{
  "defect_id": "DEF-003",
  "detected_at": "2026-07-18T04:51:42Z",
  "test_id": "p2-02-create-project",
  "page_url": "https://hq.neurecore.com/projects/new",
  "action_attempted": "Filled project essentials form (Name=AEIC Nutrition Program 2026, Description=..., Customer=AEIC Test Customer Alpha) and clicked 'Continue to Discovery'",
  "expected_result": "Navigate to step 2 (Discovery) or create the project",
  "actual_result": "Button changed to 'Creating...', then two 401 Unauthorized responses from /api/v1 endpoints, then page redirected to /login. The fetch /api/v1/projects confirms 0 projects exist. Project creation did NOT succeed.",
  "trace_id": "CONSOLE ERR: 401 (twice) at 04:51:42Z and 04:51:42Z",
  "screenshot": "phase2-22-discovery-step.png (shows 'Creating...' button state)",
  "severity": "HIGH",
  "affects_later_tests": "YES — Project creation is required for downstream entity creation (Stages, Tasks, Knowledge)",
  "decision": "PAUSE_THEN_CONTINUE",
  "backlog_entry_created": "YES",
  "remediation_run_id": "PENDING",
  "notes": "Most likely root cause: Session token (HttpOnly __Host-nc_at cookie) expired during the long wait between creating the customer (clean 200 response) and creating the project (40+ minutes later). The fetch-login workaround does set the cookie but the Next.js client-side auth context may not have been refreshed, OR the project creation API endpoint specifically requires a fresh session. Investigation needed: maybe session refresh endpoint exists; maybe the wizard state is preserved across login."
}
