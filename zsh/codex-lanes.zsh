# Source after llm-router-pilot/all-lanes.sh and the Locus shell integration.
# The provider library launches `command codex`, bypassing the codex() wrapper.
codexdk() {
  _locus_wrap_app codex utilities-terminal -- _llm_router_pilot_d_codex "system.ai.kimi-k3" "$@"
}

codexdkc() {
  codexdk resume --last "$@"
}
