#!/usr/bin/env node

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// Load .env file from the project root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

// Get the API key from environment variables
const API_KEY = process.env.EVENTBRITE_API_KEY || process.env.EVENTBRITEAPIKEY;

if (!API_KEY) {
  console.error("Error: EVENTBRITE_API_KEY environment variable is required");
  console.error("");
  console.error("To use this tool, run it with your Eventbrite API key:");
  console.error(
    "EVENTBRITE_API_KEY=your-api-key npx @ibraheem4/eventbrite-mcp"
  );
  console.error("");
  console.error("Or set it in your environment:");
  console.error("export EVENTBRITE_API_KEY=your-api-key");
  console.error("npx @ibraheem4/eventbrite-mcp");
  process.exit(1);
}

// Eventbrite API interfaces
interface EventbriteEvent {
  id: string;
  name: {
    text: string;
    html: string;
  };
  description?: {
    text: string;
    html: string;
  };
  url: string;
  start: {
    timezone: string;
    local: string;
    utc: string;
  };
  end: {
    timezone: string;
    local: string;
    utc: string;
  };
  venue_id?: string;
  venue?: {
    id: string;
    name: string;
    address: {
      address_1: string;
      address_2?: string;
      city: string;
      region?: string;
      postal_code: string;
      country: string;
    };
  };
  capacity?: number;
  category_id?: string;
  is_free: boolean;
  logo_id?: string;
  logo?: {
    url: string;
  };
}

interface EventbriteVenue {
  id: string;
  name: string;
  address: {
    address_1: string;
    address_2?: string;
    city: string;
    region?: string;
    postal_code: string;
    country: string;
  };
  capacity?: number;
}

interface EventbriteCategory {
  id: string;
  name: string;
  short_name?: string;
}

interface SearchEventsParams {
  q?: string;
  location?: {
    latitude: number;
    longitude: number;
    within?: string;
  };
  categories?: string[];
  start_date?: string;
  end_date?: string;
  price?: "free" | "paid";
  page?: number;
  page_size?: number;
}

// Create Eventbrite API client
class EventbriteApiClient {
  private client: AxiosInstance;
  private baseUrl = "https://www.eventbriteapi.com/v3";

  constructor(private apiKey: string) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get user's organizations
   */
  async getOrganizations(): Promise<any[]> {
    try {
      const response = await this.client.get("/users/me/organizations/");
      return response.data.organizations;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Eventbrite API error: ${
            error.response?.data?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * List events by organization
   */
  async listEventsByOrganization(
    organizationId: string,
    params: SearchEventsParams = {}
  ): Promise<{ events: EventbriteEvent[]; pagination: any }> {
    try {
      const queryParams: Record<string, any> = {};

      if (params.q) {
        queryParams.q = params.q;
      }

      if (params.start_date) {
        queryParams.start_date = params.start_date;
      }

      if (params.end_date) {
        queryParams.end_date = params.end_date;
      }

      if (params.page) {
        queryParams.page = params.page;
      }

      if (params.page_size) {
        queryParams.page_size = params.page_size;
      }

      const response = await this.client.get(
        `/organizations/${organizationId}/events/`,
        {
          params: queryParams,
        }
      );
      return {
        events: response.data.events,
        pagination: response.data.pagination,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Eventbrite API error: ${
            error.response?.data?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Search for events (using organization events as a replacement for the deprecated search API)
   */
  async searchEvents(
    params: SearchEventsParams
  ): Promise<{ events: EventbriteEvent[]; pagination: any }> {
    try {
      // Get the user's organizations
      const organizations = await this.getOrganizations();

      if (!organizations || organizations.length === 0) {
        return { events: [], pagination: { page_count: 0 } };
      }

      // Use the first organization to list events
      const organizationId = organizations[0].id;

      return await this.listEventsByOrganization(organizationId, params);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Eventbrite API error: ${
            error.response?.data?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Get event details by ID
   */
  async getEvent(eventId: string): Promise<EventbriteEvent> {
    try {
      const response = await this.client.get(`/events/${eventId}/`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Eventbrite API error: ${
            error.response?.data?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Get venue details by ID
   */
  async getVenue(venueId: string): Promise<EventbriteVenue> {
    try {
      const response = await this.client.get(`/venues/${venueId}/`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Eventbrite API error: ${
            error.response?.data?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<EventbriteCategory[]> {
    try {
      const response = await this.client.get("/categories/");
      return response.data.categories;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Eventbrite API error: ${
            error.response?.data?.error_description || error.message
          }`
        );
      }
      throw error;
    }
  }
}

// Initialize the Eventbrite API client
const eventbriteClient = new EventbriteApiClient(API_KEY);

// Create the MCP server
const server = new Server(
  {
    name: "eventbrite-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {
        eventbrite_event: true,
      },
      tools: {
        search_events: true,
        get_event: true,
        get_categories: true,
        get_venue: true,
      },
    },
  }
);

// Set up resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [],
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "eventbrite://events/{eventId}",
      name: "Event details",
      mimeType: "application/json",
      description: "Get detailed information about a specific Eventbrite event",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
  const eventMatch = request.params.uri.match(
    /^eventbrite:\/\/events\/([^/]+)$/
  );

  if (eventMatch) {
    const eventId = eventMatch[1];
    try {
      const event = await eventbriteClient.getEvent(eventId);

      // If the event has a venue_id but no venue data, fetch the venue
      if (event.venue_id && !event.venue) {
        try {
          event.venue = await eventbriteClient.getVenue(event.venue_id);
        } catch (error) {
          console.error(`Failed to fetch venue: ${error}`);
          // Continue without venue data
        }
      }

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(event, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch event: ${error}`
      );
    }
  }

  throw new McpError(
    ErrorCode.InvalidRequest,
    `Invalid URI format: ${request.params.uri}`
  );
});

// Set up tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_events",
      description: "Search for Eventbrite events based on various criteria",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for events",
          },
          location: {
            type: "object",
            properties: {
              latitude: { type: "number" },
              longitude: { type: "number" },
              within: {
                type: "string",
                description: "Distance (e.g., '10km', '10mi')",
              },
            },
            required: ["latitude", "longitude"],
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "Category IDs to filter by",
          },
          start_date: {
            type: "string",
            description:
              "Start date in ISO format (e.g., '2023-01-01T00:00:00Z')",
          },
          end_date: {
            type: "string",
            description:
              "End date in ISO format (e.g., '2023-12-31T23:59:59Z')",
          },
          price: {
            type: "string",
            enum: ["free", "paid"],
            description: "Filter by free or paid events",
          },
          page: {
            type: "number",
            description: "Page number for pagination",
          },
          page_size: {
            type: "number",
            description: "Number of results per page (max 100)",
          },
        },
      },
    },
    {
      name: "get_event",
      description: "Get detailed information about a specific Eventbrite event",
      inputSchema: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "Eventbrite event ID",
          },
        },
        required: ["event_id"],
      },
    },
    {
      name: "get_categories",
      description: "Get a list of Eventbrite event categories",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_venue",
      description: "Get information about a specific Eventbrite venue",
      inputSchema: {
        type: "object",
        properties: {
          venue_id: {
            type: "string",
            description: "Eventbrite venue ID",
          },
        },
        required: ["venue_id"],
      },
    },
  ],
}));

type SearchEventsArgs = {
  query?: string;
  location?: {
    latitude: number;
    longitude: number;
    within?: string;
  };
  categories?: string[];
  start_date?: string;
  end_date?: string;
  price?: "free" | "paid";
  page?: number;
  page_size?: number;
};

type GetEventArgs = {
  event_id: string;
};

type GetVenueArgs = {
  venue_id: string;
};

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "search_events": {
        const args = request.params.arguments as unknown as SearchEventsArgs;
        const params: SearchEventsParams = {};

        if (args.query) params.q = args.query;
        if (args.location) params.location = args.location;
        if (args.categories) params.categories = args.categories;
        if (args.start_date) params.start_date = args.start_date;
        if (args.end_date) params.end_date = args.end_date;
        if (args.price) params.price = args.price;
        if (args.page) params.page = args.page;
        if (args.page_size) params.page_size = args.page_size;

        const result = await eventbriteClient.searchEvents(params);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_event": {
        const args = request.params.arguments as unknown as GetEventArgs;
        if (!args?.event_id) {
          throw new Error("Event ID is required");
        }

        const event = await eventbriteClient.getEvent(args.event_id);

        // If the event has a venue_id but no venue data, fetch the venue
        if (event.venue_id && !event.venue) {
          try {
            event.venue = await eventbriteClient.getVenue(event.venue_id);
          } catch (error) {
            console.error(`Failed to fetch venue: ${error}`);
            // Continue without venue data
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(event, null, 2),
            },
          ],
        };
      }

      case "get_categories": {
        const categories = await eventbriteClient.getCategories();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      }

      case "get_venue": {
        const args = request.params.arguments as unknown as GetVenueArgs;
        if (!args?.venue_id) {
          throw new Error("Venue ID is required");
        }

        const venue = await eventbriteClient.getVenue(args.venue_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(venue, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error: any) {
    console.error("Eventbrite API Error:", error);
    return {
      content: [
        {
          type: "text",
          text: `Eventbrite API error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eventbrite MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
