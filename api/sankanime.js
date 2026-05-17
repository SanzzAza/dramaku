import axios from "axios";

const BASE = "https://www.sankavollerei.com/anime/stream";

export default async function handler(req, res) {
  const { action, q, slug, page = 1 } = req.query;

  try {
    let url = "";

    switch (action) {
      case "latest":
        url = `${BASE}/latest?page=${page}`;
        break;

      case "popular":
        url = `${BASE}/popular`;
        break;

      case "search":
        if (!q) {
          return res.status(400).json({
            status: false,
            message: "query q required",
          });
        }

        url = `${BASE}/search?query=${encodeURIComponent(q)}`;
        break;

      case "detail":
        if (!slug) {
          return res.status(400).json({
            status: false,
            message: "slug required",
          });
        }

        url = `${BASE}/anime/${slug}`;
        break;

      case "episode":
        if (!slug) {
          return res.status(400).json({
            status: false,
            message: "slug required",
          });
        }

        url = `${BASE}/episode/${slug}`;
        break;

      case "movie":
        url = `${BASE}/movie?page=${page}`;
        break;

      case "list":
        url = `${BASE}/list?page=${page}`;
        break;

      case "genres":
        url = `${BASE}/genres`;
        break;

      case "genre":
        if (!slug) {
          return res.status(400).json({
            status: false,
            message: "genre slug required",
          });
        }

        url = `${BASE}/genre/${slug}?page=${page}`;
        break;

      default:
        return res.status(400).json({
          status: false,
          message:
            "invalid action. use latest/popular/search/detail/episode/movie/list/genres/genre",
        });
    }

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
      },
    });

    res.status(200).json({
      status: true,
      result: data,
    });
  } catch (e) {
    res.status(500).json({
      status: false,
      message: e.message,
    });
  }
}
