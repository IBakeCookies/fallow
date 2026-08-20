# Sandbox image for the rule-adherence eval (eval/README.md).
#
# The agent under test gets an unrestricted shell in here, so everything it
# needs has to be present: node, git, the Claude Code CLI, and this repo's
# installed dependency tree. Dependencies are baked in at /home/agent/deps
# rather than mounted or installed per run — see eval/README.md, "node_modules".
#
# Build from the repo root:
#   npx sandcastle docker build-image --image-name fallow-eval \
#     --dockerfile .sandcastle/Dockerfile
FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Build-args for UID/GID alignment: `sandcastle docker build-image` defaults
# these to the host user's, so bind-mounted worktree files share an owner with
# image-built files and neither side needs a runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node

USER ${AGENT_UID}:${AGENT_GID}

# The agent under test.
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/agent/.local/bin:$PATH"

# The dependency tree, outside the worktree mount point so the bind-mount
# cannot shadow it. Each run copies it in as ./node_modules — a symlink leaves
# the real tree outside vite's root, which breaks the `storybook` vitest
# project (eval/sandbox.mjs, `setup`).
# `npm ci` runs this repo's `prepare` (paraglide compile, then a `svelte-kit
# sync` that is allowed to fail), so project.inlang has to be here too.
WORKDIR /home/agent/deps
COPY --chown=${AGENT_UID}:${AGENT_GID} package.json package-lock.json ./
COPY --chown=${AGENT_UID}:${AGENT_GID} project.inlang ./project.inlang
RUN npm ci

# vitest's `client` and `storybook` projects drive chromium through Playwright.
# Installed from the pinned playwright in node_modules so the browser build
# matches, and world-readable so the agent user can launch it.
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN npx playwright install --with-deps chromium && chmod -R a+rX /opt/playwright

USER ${AGENT_UID}:${AGENT_GID}
WORKDIR /home/agent

# Sandcastle bind-mounts the git worktree over the workdir and overrides the
# working directory at container start; this just keeps the container alive.
ENTRYPOINT ["sleep", "infinity"]
