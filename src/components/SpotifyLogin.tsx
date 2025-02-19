import type { FC } from "react";
import { getAuthUrl } from "../services/spotify";

export const SpotifyLogin: FC = () => {
  const handleLogin = () => {
    window.location.href = getAuthUrl();
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="spotify-login-button"
    >
      Connect to Spotify
    </button>
  );
};
