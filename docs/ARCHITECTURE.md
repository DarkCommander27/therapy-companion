# Architecture Overview (CareBridge Companion)

## High-level
- Frontend: React
- Backend: Express
- NLU: Intent recognition + emotion detection
- Models: Local inference preferred (privacy-first)
- Deployment: Local-first (facility-controlled)

## Core modules
- Companion chat service
- NLU pipeline (intent + emotion)
- Safety monitoring + incident logging
- Briefing generator (daily/weekly)
- Safeguarding monitoring (access-based) + audit logs

## Key boundary
- No staff-to-youth messaging inside the system.