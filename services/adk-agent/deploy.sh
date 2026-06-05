#!/usr/bin/env bash
# Deploy the ADK reply agent to Google Cloud Run.
#
# Prerequisites (not present on the dev machine where this was authored — install
# before running): gcloud CLI, an authenticated account (`gcloud auth login`), and
# a project with billing + Cloud Run + Cloud Build APIs enabled.
#
# Usage:
#   GCP_PROJECT=my-project \
#   GEMINI_API_KEY=... \
#   ADK_SHARED_SECRET=... \
#   ./deploy.sh
set -euo pipefail

: "${GCP_PROJECT:?set GCP_PROJECT}"
: "${GEMINI_API_KEY:?set GEMINI_API_KEY}"
: "${ADK_SHARED_SECRET:?set ADK_SHARED_SECRET}"

REGION="${GCP_REGION:-us-central1}"
SERVICE="${SERVICE_NAME:-adk-reply-agent}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

# Vertex AI: o ADK roda dentro do GCP e usa a identidade (service account) do
# Cloud Run — NAO precisa de chave .json. Garanta que essa SA tenha
# roles/aiplatform.user. GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION dizem ao
# SDK google-genai para onde apontar quando USE_VERTEXAI=1.
GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"

# Build with Cloud Build and deploy from source (no local Docker required).
gcloud run deploy "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${REGION}" \
  --source . \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY},GEMINI_MODEL=${GEMINI_MODEL},ADK_SHARED_SECRET=${ADK_SHARED_SECRET},GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION}"

echo
echo "Deployed. Service URL:"
gcloud run services describe "${SERVICE}" --project "${GCP_PROJECT}" --region "${REGION}" --format 'value(status.url)'
echo
echo "Set ADK_REPLY_URL in the TS app to <URL>/v1/decide and ADK_SHARED_SECRET to the same secret."
echo "View decision traces in Cloud Logging:"
echo "  gcloud logging read 'resource.type=cloud_run_revision AND jsonPayload.component=adk-reply-agent' --project ${GCP_PROJECT} --limit 50"
