import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAccessToken } from "../services/spotify";

type CallbackSearch = {
  code: string;
};

export const Route = createFileRoute("/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => {
    return {
      code: search.code as string,
    };
  },
  beforeLoad: async ({ search }) => {
    const code = search.code;

    if (!code) {
      throw new Error("No code provided");
    }

    try {
      const { access_token, refresh_token } = await getAccessToken(code);

      // Store tokens in localStorage
      localStorage.setItem("spotify_access_token", access_token);
      localStorage.setItem("spotify_refresh_token", refresh_token);

      // Redirect to home page
      throw redirect({
        to: "/",
      });
    } catch (error) {
      console.error("Failed to get access token:", error);
      throw error;
    }
  },
  component: () => null,
});
