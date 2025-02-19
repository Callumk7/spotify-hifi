const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "app-remote-control",
];

let player: Spotify.Player | null = null;

interface SpotifyTrackItem {
  id: string;
  name: string;
  duration_ms: number;
}

// Add a promise that resolves when the SDK is ready
let sdkReadyPromise: Promise<void>;

if (typeof window !== "undefined") {
  sdkReadyPromise = new Promise((resolve) => {
    if (window.Spotify) {
      resolve();
    } else {
      window.onSpotifyWebPlaybackSDKReady = () => {
        resolve();
      };
    }
  });
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    show_dialog: "true",
  });

  return `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function initializePlayer(): Promise<Spotify.Player> {
  console.log("Initializing Spotify player...");

  // Wait for the SDK to be ready
  await sdkReadyPromise;

  if (!window.Spotify) {
    console.error("Spotify Web Playback SDK not loaded");
    throw new Error("Spotify Web Playback SDK not loaded");
  }

  if (player) {
    console.log("Player already initialized");
    // Set initial volume on existing player
    const savedVolume = localStorage.getItem("spotify_volume");
    if (savedVolume) {
      await player.setVolume(Number(savedVolume) / 100);
    }
    return player;
  }

  const accessToken = localStorage.getItem("spotify_access_token");
  if (!accessToken) {
    console.error("No access token available");
    throw new Error("No access token available");
  }

  return new Promise((resolve, reject) => {
    console.log("Creating new Spotify player instance");
    const savedVolume = localStorage.getItem("spotify_volume");
    player = new window.Spotify.Player({
      name: "Virtual HiFi",
      getOAuthToken: (cb) => {
        console.log("Getting OAuth token");
        cb(accessToken);
      },
      volume: savedVolume ? Number(savedVolume) / 100 : 0.5,
    });

    // Error handling
    player.addListener("initialization_error", ({ message }) => {
      console.error("Player initialization error:", message);
      reject(new Error(message));
    });
    player.addListener("authentication_error", ({ message }) => {
      console.error("Player authentication error:", message);
      reject(new Error(message));
    });
    player.addListener("account_error", ({ message }) => {
      console.error("Player account error:", message);
      reject(new Error(message));
    });
    player.addListener("playback_error", ({ message }) => {
      console.error("Player playback error:", message);
    });

    // Ready handling
    player.addListener("ready", ({ device_id }) => {
      console.log("Player ready with device ID:", device_id);
      localStorage.setItem("spotify_device_id", device_id);
      if (player) {
        resolve(player);
      } else {
        reject(new Error("Player instance is null"));
      }
    });

    // Not ready handling
    player.addListener("not_ready", ({ device_id }) => {
      console.warn("Device ID has gone offline:", device_id);
      localStorage.removeItem("spotify_device_id");
    });

    // Player state changes
    player.addListener("player_state_changed", (state) => {
      console.log("Player state changed:", state);
    });

    console.log("Connecting to Spotify...");
    player.connect().then((connected) => {
      if (!connected) {
        const error = new Error("Failed to connect to Spotify");
        console.error(error);
        reject(error);
      }
      console.log("Successfully connected to Spotify");
    });
  });
}

export async function getAccessToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token request failed:", error);
    throw new Error("Failed to get access token");
  }

  return response.json();
}

export async function searchTracks(query: string) {
  const accessToken = localStorage.getItem("spotify_access_token");
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      query
    )}&type=track&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to search tracks");
  }

  return response.json();
}

export async function getTrack(trackId: string) {
  const accessToken = localStorage.getItem("spotify_access_token");
  const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get track");
  }

  return response.json();
}

export async function getCurrentPlaybackState(): Promise<Spotify.PlaybackState | null> {
  if (!player) {
    console.warn("No player instance available for getting state");
    return null;
  }

  const state = await player.getCurrentState();
  console.log("Current playback state:", state);
  return state;
}

export async function play(trackUri?: string) {
  console.log("Attempting to play track:", trackUri);
  if (!player) {
    console.log("No player instance, initializing...");
    await initializePlayer();
  }

  const accessToken = localStorage.getItem("spotify_access_token");
  const deviceId = localStorage.getItem("spotify_device_id");

  if (!deviceId) {
    console.error("No active device found");
    throw new Error(
      "No active device found. Please wait for the player to initialize."
    );
  }

  console.log("Playing on device:", deviceId);
  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: trackUri
        ? JSON.stringify({
            uris: [`spotify:track:${trackUri}`],
            position_ms: 0,
          })
        : undefined,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Playback failed:", {
      status: response.status,
      statusText: response.statusText,
      error,
    });
    throw new Error("Failed to start playback");
  }

  console.log("Playback started successfully");
}

export async function pause() {
  console.log("Attempting to pause playback");
  if (!player) {
    console.warn("No player instance available for pause");
    return;
  }

  await player.pause();
  console.log("Playback paused");
}

export async function seek(positionMs: number) {
  if (!player) {
    return;
  }

  await player.seek(positionMs);
}

export async function setVolume(volumePercent: number) {
  console.log("Setting volume to:", volumePercent);

  // Store volume in localStorage
  localStorage.setItem("spotify_volume", volumePercent.toString());

  if (!player) {
    console.warn("No player instance available for volume control");
    return;
  }

  try {
    await player.setVolume(volumePercent / 100);
    console.log("Volume set successfully");
  } catch (error) {
    console.error("Failed to set volume:", error);
  }
}

export async function logout() {
  // Disconnect the player if it exists
  if (player) {
    await player.disconnect();
    player = null;
  }

  // Clear all Spotify related data from localStorage
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_device_id");

  // Redirect to Spotify logout URL and then back to the app
  const logoutUrl = "https://accounts.spotify.com/logout";
  const currentOrigin = window.location.origin;

  // Open logout in a popup
  const popup = window.open(
    logoutUrl,
    "Spotify Logout",
    "width=500,height=500"
  );
  if (popup) {
    setTimeout(() => {
      popup.close();
      window.location.href = currentOrigin;
    }, 2000);
  }
}

export async function getAlbumTracks(albumId: string) {
  console.log("Fetching tracks for album:", albumId);
  const accessToken = localStorage.getItem("spotify_access_token");
  const response = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}/tracks`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    console.error("Failed to fetch album tracks:", await response.text());
    throw new Error("Failed to fetch album tracks");
  }

  const data = await response.json();
  console.log("Received album tracks:", data);
  return data.items.map((track: SpotifyTrackItem) => ({
    id: track.id,
    name: track.name,
    duration_ms: track.duration_ms,
  }));
}
