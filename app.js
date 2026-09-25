// Reliable public Invidious instances with CORS support
const INSTANCES = [
  "https://inv.tux.pizza",
  "https://invidious.nerdvpn.de",
  "https://vid.puffyan.us"
];

let currentInstance = INSTANCES[0];
let activeVideo = null;

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("results");
const statusMsg = document.getElementById("status");
const audio = document.getElementById("audioElement");
const playerThumb = document.getElementById("playerThumb");
const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");

searchBtn.addEventListener("click", performSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") performSearch();
});

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  statusMsg.textContent = "Searching...";
  resultsContainer.innerHTML = "";

  for (const instance of INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      if (!res.ok) continue;
      const data = await res.json();
      currentInstance = instance;
      renderResults(data);
      statusMsg.textContent = "";
      return;
    } catch {
      // Rotate instance on failure
      continue;
    }
  }
  statusMsg.textContent = "Failed to load results. Try again later.";
}

function renderResults(videos) {
  if (!videos || videos.length === 0) {
    statusMsg.textContent = "No tracks found.";
    return;
  }

  videos.forEach((video) => {
    const thumb = video.videoThumbnails?.find((t) => t.quality === "medium")?.url || "";
    const card = document.createElement("div");
    card.className = "track-item";
    card.innerHTML = `
      <img src="${thumb}" alt="${video.title}">
      <div class="track-info">
        <span class="title">${video.title}</span>
        <span class="author">${video.author}</span>
      </div>
    `;

    card.addEventListener("click", () => playTrack(video.videoId, video.title, video.author, thumb));
    resultsContainer.appendChild(card);
  });
}

async function playTrack(videoId, title, author, thumb) {
  statusMsg.textContent = "Fetching audio stream...";

  try {
    const res = await fetch(`${currentInstance}/api/v1/videos/${videoId}`);
    const data = await res.json();

    // Find highest quality audio-only stream
    const audioFormats = data.adaptiveFormats.filter(
      (f) => f.type && f.type.startsWith("audio/")
    );

    if (audioFormats.length === 0) {
      statusMsg.textContent = "No playable audio stream available.";
      return;
    }

    // Sort by highest bitrate
    audioFormats.sort((a, b) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0));
    const audioUrl = audioFormats[0].url;

    // Load stream into audio element
    audio.src = audioUrl;
    audio.play();

    // Update bottom UI
    playerThumb.src = thumb;
    playerThumb.style.display = "block";
    playerTitle.textContent = title;
    playerArtist.textContent = author;
    statusMsg.textContent = "";

    // Register Background Playback Controls
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: author,
        artwork: [{ src: thumb, sizes: "512x512", type: "image/jpeg" }]
      });

      navigator.mediaSession.setActionHandler("play", () => audio.play());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime) audio.currentTime = details.seekTime;
      });
    }
  } catch (err) {
    statusMsg.textContent = "Error playing track. Try selecting another song.";
  }
}
