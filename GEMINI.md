# GEMINI Context: mcp-testing

## Project Overview
`mcp-testing` is a dedicated workspace for configuring and testing the **Model Context Protocol (MCP)**. It serves as an integration environment for local LLMs (via **Ollama**) and specialized MCP servers.

### Key Components:
- **MCP Servers:** Configured to use the Playwright MCP server (`@modelcontextprotocol/server-playwright`) for browser automation tasks.
- **Local Models:** Integrates with Ollama for running models like `llama3.2`.
- **Infrastructure:** Built with Node.js and the Model Context Protocol SDK.

## Configuration and Usage

### Key Files:
- **`config.json`**: The primary configuration file for the MCP client/environment. It defines the available models, MCP servers (like Playwright), and autocomplete settings.
- **`package.json`**: Manages the core dependencies required for MCP experimentation (`@modelcontextprotocol/sdk`, `playwright`).

### Building and Running:
- **Install Dependencies**:
  ```powershell
  npm install
  ```
- **Run MCP Server (via Config)**:
  The Playwright MCP server is configured to run dynamically using `npx`:
  ```powershell
  npx -y @modelcontextprotocol/server-playwright
  ```

## Development Conventions
- **Experimentation First**: This workspace is designed for testing MCP integrations. New servers should be added to the `mcpServers` section in `config.json`.
- **Tool Configuration**: The `config.json` format is compatible with MCP-enabled IDE extensions (e.g., Continue, Cursor-like environments).
- **Environment**: Primarily focused on local execution using Ollama and local MCP server instances.
