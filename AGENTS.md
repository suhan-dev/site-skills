# AGENTS.md

For AI coding assistants other than Claude (Codex, Cursor, Gemini, Copilot …). The full instructions are in
**[CLAUDE.md](CLAUDE.md)**; they apply to you too. If the two ever differ, CLAUDE.md wins.

Short version:

- This repository is a library of skills. Each `skills/<name>/SKILL.md` is a complete instruction set; read it, then
  the files it links. `docs/START-HERE.md` says which skills to use, in which order, and what to ask the user first.
- Never commit secrets or personal data. Secrets belong in the host's environment variables. Run
  `bash tools/privacy-scan.sh` before every push.
- Docs are English, short and plain. Talk to the user in their language.
- When you change a skill, keep its layout (`CONTRIBUTING.md`) and run `node tools/check-skills.mjs`.
