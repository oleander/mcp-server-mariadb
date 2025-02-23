#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as mariadb from 'mariadb';
import { Pool, PoolConnection } from 'mariadb';

interface TableRow {
  table_name: string;
}

interface ColumnRow {
  column_name: string;
  data_type: string;
}

const config = {
  server: {
    name: "example-servers/mariadb",
    version: "0.1.0",
  },
  mariadb: {
    host: process.env.MARIADB_HOST || "127.0.0.1",
    port: Number(process.env.MARIADB_PORT || "3306"),
    user: process.env.MARIADB_USER || "root",
    password: process.env.MARIADB_PASS || "",
    database: process.env.MARIADB_DB || "",
    connectionLimit: 10,
  },
  paths: {
    schema: "schema",
  },
};

const mariadbQuery = <T>(
  connection: PoolConnection,
  sql: string,
  params: any[] = [],
): Promise<T> => {
  return new Promise((resolve, reject) => {
    connection.query(sql, params)
      .then((results: T) => resolve(results))
      .catch((error: Error) => reject(error));
  });
};

const mariadbGetConnection = (pool: Pool): Promise<PoolConnection> => {
  return new Promise((resolve, reject) => {
    pool.getConnection()
      .then((connection: PoolConnection) => resolve(connection))
      .catch((error: Error) => reject(error));
  });
};

const mariadbBeginTransaction = (connection: PoolConnection): Promise<void> => {
  return new Promise((resolve, reject) => {
    connection.beginTransaction()
      .then(() => resolve())
      .catch((error: Error) => reject(error));
  });
};

const mariadbRollback = (connection: PoolConnection): Promise<void> => {
  return new Promise((resolve, _) => {
    connection.rollback()
      .then(() => resolve())
      .catch(() => resolve());
  });
};

const pool = mariadb.createPool(config.mariadb);
const server = new Server(config.server, {
  capabilities: {
    resources: {},
    tools: {},
  },
});

async function executeQuery<T>(sql: string, params: any[] = []): Promise<T> {
  const connection = await mariadbGetConnection(pool);
  try {
    const results = await mariadbQuery<T>(connection, sql, params);
    return results;
  } finally {
    connection.release();
  }
}

async function executeReadOnlyQuery<T>(sql: string): Promise<T> {
  const connection = await mariadbGetConnection(pool);

  try {
    // Set read-only mode
    await mariadbQuery(connection, "SET SESSION TRANSACTION READ ONLY");

    // Begin transaction
    await mariadbBeginTransaction(connection);

    // Execute query
    const results = await mariadbQuery(connection, sql);

    // Rollback transaction (since it's read-only)
    await mariadbRollback(connection);

    return <T>{
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    await mariadbRollback(connection);
    throw error;
  } finally {
    try {
      // Always reset to read-write mode before releasing the connection
      await mariadbQuery(connection, "SET SESSION TRANSACTION READ WRITE");
    } catch (resetError) {
      console.error("Error resetting transaction mode:", resetError);
    }
    connection.release();
  }
}

// Request handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const results = (await executeQuery(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()",
  )) as TableRow[];

  return {
    resources: results.map((row: TableRow) => ({
      uri: new URL(
        `${row.table_name}/${config.paths.schema}`,
        `${config.mariadb.host}:${config.mariadb.port}`,
      ).href,
      mimeType: "application/json",
      name: `"${row.table_name}" database schema`,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== config.paths.schema) {
    throw new Error("Invalid resource URI");
  }

  const results = (await executeQuery(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ?",
    [tableName],
  )) as ColumnRow[];

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "mariadb_query",
      description: "Run a read-only MariaDB query",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "mariadb_query") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const sql = request.params.arguments?.sql as string;
  return executeReadOnlyQuery(sql);
});

// Server startup and shutdown
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down...`);
  return new Promise<void>((resolve, reject) => {
    pool.end()
      .then(() => resolve())
      .catch((err: Error) => {
        console.error("Error closing pool:", err);
        reject(err);
      });
  });
};

process.on("SIGINT", async () => {
  try {
    await shutdown("SIGINT");
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  try {
    await shutdown("SIGTERM");
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
});

runServer().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
