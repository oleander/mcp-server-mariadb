# MCP Server for MariaDB based on NodeJS

[![smithery badge](https://smithery.ai/badge/@oleander/mcp-server-mariadb)](https://smithery.ai/server/@oleander/mcp-server-mariadb)
![Demo](assets/demo.gif)

A Model Context Protocol server that provides read-only access to MariaDB databases. This server enables LLMs to inspect database schemas and execute read-only queries.

## Components

### Tools

- **mariadb_query**
  - Execute read-only SQL queries against the connected database
  - Input: `sql` (string): The SQL query to execute
  - All queries are executed within a READ ONLY transaction

### Resources

The server provides schema information for each table in the database:

- **Table Schemas**
  - JSON schema information for each table
  - Includes column names and data types
  - Automatically discovered from database metadata

## Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp_server_mariadb": {
      "command": "npx",
      "args": ["-y", "@oleander/mcp-server-mariadb"],
      "env": {
        "MARIADB_HOST": "127.0.0.1",
        "MARIADB_PORT": "3306",
        "MARIADB_USER": "root",
        "MARIADB_PASS": "",
        "MARIADB_DB": "db_name"
      }
    }
  }
}
```

Replace `/db_name` with your database name or leave it blank to retrieve all databases.

## Logging

This server uses the `winston` logging library to provide detailed log output. The log level can be controlled using the `LOG_LEVEL` environment variable. The available log levels are:

- `error`: Logs only error messages
- `warn`: Logs warnings and error messages
- `info`: Logs informational messages, warnings, and error messages
- `debug`: Logs debug messages, informational messages, warnings, and error messages

To set the log level, add the `LOG_LEVEL` environment variable to your configuration. For example:

```json
{
  "mcpServers": {
    "mcp_server_mariadb": {
      "command": "npx",
      "args": ["-y", "@oleander/mcp-server-mariadb"],
      "env": {
        "MARIADB_HOST": "127.0.0.1",
        "MARIADB_PORT": "3306",
        "MARIADB_USER": "root",
        "MARIADB_PASS": "",
        "MARIADB_DB": "db_name",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Troubleshooting

### Package Installation

During package installation, the package will automatically compile the TypeScript code to JavaScript. This happens through the `prepare` script which runs `npm run build`. If you encounter any compilation errors during installation, ensure you have sufficient permissions and that your environment meets the following requirements:

- Node.js installed and accessible in your PATH
- Sufficient permissions to execute npm scripts
- Access to write to the installation directory

### Connection Issues

If you encounter an error "Could not connect to MCP server mcp-server-mariadb", you may need to explicitly
set the path of all required binaries such as the configuration below:

```json
{
  "mcpServers": {
    "mcp_server_mariadb": {
      "command": "/path/to/npx/binary/npx",
      "args": ["-y", "@oleander/mcp-server-mariadb"],
      "env": {
        "MARIADB_HOST": "127.0.0.1",
        "MARIADB_PORT": "3306",
        "MARIADB_USER": "root",
        "MARIADB_PASS": "",
        "MARIADB_DB": "db_name",
        "PATH": "/path/to/node/bin:/usr/bin:/bin"
      }
    }
  }
}
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
