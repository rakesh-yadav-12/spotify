let currentSong = new Audio();
let currentTrack = "";
let songs = [];
let currentFolder = "";
let allFolders = [];

// DOM Elements
const elements = {
  songList: document.querySelector(".songList ul"),
  songInfo: document.querySelector(".songinfo"),
  songTime: document.querySelector(".songtime"),
  seekCircle: document.querySelector(".seekbar .circle"),
  playBtn: document.querySelector("#play"),
  folderTitle: document.querySelector(".folder-title"),
  cardContainer: document.querySelector('.cardcontainer'),
  hamburger: document.querySelector('.hamburger'),
  leftPanel: document.querySelector('.left'),
  volumeSlider: document.querySelector(".volume-slider"),
  volumeIcon: document.querySelector(".volume-icon"),
  previousBtn: document.querySelector("#previous"),
  nextBtn: document.querySelector("#next"),
  seekbar: document.querySelector(".seekbar"),
  folderPicker: document.querySelector("#folderPicker"),
  loadingIndicator: document.querySelector("#loadingIndicator")
};

// Utility functions
function getElement(selector) {
  const el = document.querySelector(selector);
  if (!el) console.warn(`Element not found: ${selector}`);
  return el;
}

function formatTime(sec) {
  if (isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function extractMetadataFromSongName(songName) {
  // First, remove any path components
  const fileName = songName.split('/').pop().split('\\').pop();
  
  const patterns = [
    { regex: /(.+)\s-\s(.+)/, nameIdx: 1, artistIdx: 2 },
    { regex: /(.+)\sft\.\s(.+)/, nameIdx: 1, artistIdx: 2 },
    { regex: /(.+)\s\((.+)\)/, nameIdx: 1, artistIdx: 2 }
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern.regex);
    if (match) {
      return {
        artist: match[pattern.artistIdx]?.trim() || "Unknown Artist",
        cleanName: match[pattern.nameIdx].trim().replace('.mp3', '').replace('.MP3', '')
      };
    }
  }

  return {
    artist: "Unknown Artist",
    cleanName: fileName.replace('.mp3', '').replace('.MP3', '').trim()
  };
}

// ============================================
// SIMPLIFIED FILE DETECTION
// ============================================

// Clean path function
function cleanPath(path) {
  return path
    .replace(/\\/g, '/')        // Replace backslashes with forward slashes
    .replace(/\/+/g, '/')       // Replace multiple slashes with single slash
    .replace(/^\//, '')         // Remove leading slash
    .replace(/\/$/, '');        // Remove trailing slash
}

// Extract just the filename from a path
function getFileNameFromPath(path) {
  return path.split(/[\\/]/).pop();
}

// Simple folder detection
async function autoDetectFolders() {
  console.log("Detecting folders...");
  
  // Directly return the folder structure
  return [
    { name: "Folder1", path: "songs/Folder1" },
    { name: "Folder2", path: "songs/Folder2" },
    { name: "folder3", path: "songs/folder3" }
  ];
}

// Get actual file names from metadata or known files
async function scanFolderForAudio(folderPath) {
  const cleanFolderPath = cleanPath(folderPath);
  console.log(`Scanning folder: ${cleanFolderPath}`);
  
  const audioFiles = [];
  const audioExtensions = ['.mp3', '.MP3', '.wav', '.m4a', '.ogg', '.flac', '.m4b', '.aac'];
  
  // First, try to get metadata.json
  try {
    const metadataUrl = `${cleanFolderPath}/metadata.json`;
    const response = await fetch(metadataUrl);
    if (response.ok) {
      const metadata = await response.json();
      if (metadata.songs && Array.isArray(metadata.songs)) {
        console.log("Found metadata.json with songs:", metadata.songs);
        metadata.songs.forEach(song => {
          if (typeof song === 'string' && song.trim()) {
            const fileName = getFileNameFromPath(song.trim()); // Get just filename
            const fileUrl = `${cleanFolderPath}/${encodeURIComponent(fileName)}`;
            audioFiles.push({
              name: fileName,
              path: `${cleanFolderPath}/${fileName}`,
              url: fileUrl
            });
          }
        });
        return audioFiles;
      }
    }
  } catch (error) {
    console.log("No metadata.json found or error:", error.message);
  }
  
  // If no metadata, use known file names based on folder
  const folderName = cleanFolderPath.split('/').pop();
  const knownFiles = {
    "Folder1": [
      "khan sir motivation speech broken he...",
      "Time importance Khan sir motivation s..."
    ],
    "Folder2": [
      "Ka Leke Shiv ke Manayi Ho.mp3",
      "Vrindavan Jana to Jarur Hai.mp3",  // Corrected name
      "RJHG1 NR Raghunandan Shri Ram..."
    ],
    "folder3": [
      "Convert Spotify Music to MP3 Files.mp3"
    ]
  };
  
  const files = knownFiles[folderName] || [];
  
  for (const file of files) {
    let fileName = file;
    
    // Ensure it has .mp3 extension if not present
    if (!audioExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
      fileName += '.mp3';
    }
    
    // Get just the filename (in case it contains path)
    const cleanFileName = getFileNameFromPath(fileName);
    
    const fileUrl = `${cleanFolderPath}/${encodeURIComponent(cleanFileName)}`;
    audioFiles.push({
      name: cleanFileName,
      path: `${cleanFolderPath}/${cleanFileName}`,
      url: fileUrl
    });
    
    console.log(`Added file: ${cleanFileName}`);
  }
  
  console.log(`Found ${audioFiles.length} audio files in ${cleanFolderPath}`);
  return audioFiles;
}

// Load folder structure
async function loadFolderStructure() {
  console.log("Loading folder structure...");
  
  const detectedFolders = await autoDetectFolders();
  const foldersWithData = [];
  
  for (const folder of detectedFolders) {
    try {
      const cleanFolderPath = cleanPath(folder.path);
      
      // Find cover image first
      const coverImage = await findCoverImage(cleanFolderPath);
      
      // Then scan for audio files
      const audioFiles = await scanFolderForAudio(cleanFolderPath);
      
      foldersWithData.push({
        name: folder.name,
        path: cleanFolderPath,
        songs: audioFiles.map(f => f.name),
        audioFiles: audioFiles,
        description: generateFolderDescription(audioFiles),
        image: coverImage,
        songCount: audioFiles.length
      });
      
      console.log(`Loaded folder: ${folder.name} with ${audioFiles.length} audio files`);
    } catch (error) {
      console.error(`Error loading folder ${folder.name}:`, error);
      // Create empty folder entry anyway
      const cleanFolderPath = cleanPath(folder.path);
      foldersWithData.push({
        name: folder.name,
        path: cleanFolderPath,
        songs: [],
        audioFiles: [],
        description: "No tracks found",
        image: `https://via.placeholder.com/300/1db954/000000?text=${encodeURIComponent(folder.name)}`,
        songCount: 0
      });
    }
  }
  
  allFolders = foldersWithData;
  console.log("All folders loaded:", allFolders);
  return foldersWithData;
}

// Find cover image in folder
async function findCoverImage(folderPath) {
  const cleanFolderPath = cleanPath(folderPath);
  const coverNames = [
    'cover.jpg', 'cover.png', 'folder.jpg', 
    'album.jpg', 'thumbnail.jpg', 'cover.jpeg', 
    'folder.jpeg', 'album.png', 'thumb.jpg'
  ];
  
  // Try direct access first
  for (const coverName of coverNames) {
    try {
      const url = `${cleanFolderPath}/${coverName}`;
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`Found cover image: ${url}`);
        return url;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Return placeholder if no cover found
  const folderName = cleanFolderPath.split('/').pop();
  return `https://via.placeholder.com/300/1db954/000000?text=${encodeURIComponent(folderName)}`;
}

// Generate description based on songs
function generateFolderDescription(audioFiles) {
  if (audioFiles.length === 0) return "Empty folder";
  if (audioFiles.length === 1) return "1 track";
  
  return `${audioFiles.length} tracks`;
}

// ============================================
// UI FUNCTIONS
// ============================================

// Show loading indicator
function showLoading(show) {
  if (!elements.loadingIndicator) return;
  
  if (show) {
    elements.loadingIndicator.style.display = 'block';
  } else {
    elements.loadingIndicator.style.display = 'none';
  }
}

// Fetch songs in a folder
async function getSongs(folderName) {
  console.log(`Loading songs for folder: ${folderName}`);
  
  const folder = allFolders.find(f => f.name === folderName);
  if (folder) {
    songs = folder.audioFiles;
    currentFolder = folder.name;
    
    console.log(`Loaded ${songs.length} songs for ${folderName}:`, songs.map(s => s.name));
    
    const metadata = {
      title: folder.name,
      description: folder.description,
      image: folder.image
    };
    
    renderSongList(metadata);
    return songs;
  }
  
  console.error("Folder not found:", folderName);
  songs = [];
  renderSongList();
  return [];
}

// Render song list UI
function renderSongList(folderMetadata = null) {
  if (!elements.songList) {
    console.error("songList element not found!");
    return;
  }

  const folderName = folderMetadata?.title || "Unknown Folder";

  if (songs.length === 0) {
    elements.songList.innerHTML = `
      <li style="text-align: center; padding: 20px; color: #666;">
        No audio files found in this folder
      </li>
    `;
  } else {
    elements.songList.innerHTML = songs.map((song, index) => {
      const { cleanName, artist } = extractMetadataFromSongName(song.name);
      const isPlaying = currentTrack === song.name;
      
      return `
        <li class="${isPlaying ? 'playing' : ''}" data-index="${index}">
          <img class="invert" src="music.svg" alt="">
          <div class="info">
            <div>${cleanName}</div>
            <div>${artist}</div>
          </div>
          <div class="playnow">
            <span>${isPlaying ? 'Now Playing' : 'Play Now'}</span>
            <img class="invert" src="${isPlaying ? 'pause.svg' : 'play.svg'}" alt="">
          </div>
        </li>
      `;
    }).join('');
  }

  if (elements.folderTitle) {
    elements.folderTitle.textContent = folderName;
  }

  // Add click event to each song
  elements.songList.querySelectorAll("li").forEach((li, index) => {
    li.addEventListener("click", async () => {
      try {
        await playMusic(songs[index]);
        
        elements.songList.querySelectorAll("li").forEach(item => {
          item.classList.remove("playing");
        });
        li.classList.add("playing");
      } catch (error) {
        console.error("Error playing song:", error);
        showError(`Could not play: ${songs[index]?.name}`);
      }
    });
  });
}

// Play music - SIMPLIFIED AND FIXED VERSION
async function playMusic(song, pause = false) {
  if (!song) {
    console.error("No song provided to playMusic");
    showError("No track selected");
    return;
  }

  currentTrack = song.name;
  const { cleanName } = extractMetadataFromSongName(song.name);
  
  console.log(`Attempting to play: ${cleanName}`);
  console.log(`Song URL: ${song.url}`);
  console.log(`Song path: ${song.path}`);
  
  // Clean the paths
  const cleanUrl = cleanPath(song.url);
  const cleanPathUrl = cleanPath(song.path);
  
  console.log(`Clean URL: ${cleanUrl}`);
  console.log(`Clean path: ${cleanPathUrl}`);
  
  // Stop current playback
  currentSong.pause();
  currentSong.currentTime = 0;
  
  // Try different URL formats - SIMPLIFIED
  let finalUrl = null;
  
  // First try the simplest path: folder + filename
  const folderName = currentFolder;
  const fileName = getFileNameFromPath(song.name);
  const simpleUrl = `songs/${folderName}/${encodeURIComponent(fileName)}`;
  
  const urlOptions = [
    simpleUrl,  // Simple path: songs/Folder2/filename.mp3
    cleanUrl,   // Original clean URL
    cleanPathUrl, // Clean path
    `${cleanPathUrl}`.replace(/ /g, '%20'),  // With spaces encoded
    `${cleanPathUrl}`.replace(/%20/g, ' '),  // Without encoding
  ];
  
  // Remove duplicates
  const uniqueUrls = [...new Set(urlOptions)];
  
  console.log("Testing URLs:", uniqueUrls);
  
  // Try each URL option
  for (const url of uniqueUrls) {
    try {
      console.log(`Testing URL: ${url}`);
      const testResponse = await fetch(url, { method: 'HEAD' });
      if (testResponse.ok) {
        finalUrl = url;
        console.log(`✓ Found valid URL: ${url}`);
        break;
      } else {
        console.log(`✗ URL failed (${testResponse.status}): ${url}`);
      }
    } catch (error) {
      console.log(`✗ URL error: ${url} - ${error.message}`);
      continue;
    }
  }
  
  if (!finalUrl) {
    console.error("No valid URL found for:", song.name);
    showError(`File not found: ${cleanName}. Trying simple path...`);
    
    // Try one more time with very simple path
    const verySimpleUrl = `songs/${folderName}/${fileName}`;
    try {
      const testResponse = await fetch(verySimpleUrl, { method: 'HEAD' });
      if (testResponse.ok) {
        finalUrl = verySimpleUrl;
        console.log(`✓ Found valid simple URL: ${verySimpleUrl}`);
      }
    } catch (error) {
      console.log(`✗ Simple URL also failed: ${verySimpleUrl}`);
    }
  }
  
  if (!finalUrl) {
    showError(`Could not find file: ${fileName}`);
    return;
  }
  
  currentSong.src = finalUrl;
  
  // Update UI
  if (elements.songInfo) {
    elements.songInfo.textContent = cleanName;
  }
  
  // Reset time display
  if (elements.songTime) {
    elements.songTime.textContent = "00:00 / 00:00";
  }
  
  if (elements.seekCircle) {
    elements.seekCircle.style.left = '0%';
  }
  
  // Clear previous event listeners
  currentSong.onloadedmetadata = null;
  currentSong.ontimeupdate = null;
  currentSong.onplay = null;
  currentSong.onpause = null;
  currentSong.onended = null;
  currentSong.onerror = null;
  
  // Set up new event listeners
  currentSong.onloadedmetadata = () => {
    console.log(`Audio loaded successfully: ${currentSong.duration} seconds`);
    if (elements.songTime) {
      elements.songTime.textContent = `00:00 / ${formatTime(currentSong.duration)}`;
    }
  };

  currentSong.ontimeupdate = () => {
    const current = currentSong.currentTime;
    const duration = currentSong.duration;
    if (elements.songTime) {
      elements.songTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }
    if (!isNaN(duration) && elements.seekCircle) {
      elements.seekCircle.style.left = `${(current/duration)*100}%`;
    }
  };

  currentSong.onplay = () => { 
    console.log("Audio playing");
    if (elements.playBtn) {
      elements.playBtn.src = "pause.svg"; 
    }
    updatePlayingState();
  };
  
  currentSong.onpause = () => { 
    console.log("Audio paused");
    if (elements.playBtn) {
      elements.playBtn.src = "play.svg"; 
    }
    updatePlayingState();
  };
  
  currentSong.onended = () => {
    console.log("Audio ended");
    playNext();
  };
  
  currentSong.onerror = (e) => {
    console.error("Audio error details:");
    console.error("- Error code:", currentSong.error?.code);
    console.error("- Error message:", currentSong.error?.message);
    console.error("- Source URL:", currentSong.src);
    
    showError(`Could not play: ${cleanName}. Trying next song...`);
    
    // Try to play next song
    setTimeout(() => {
      playNext();
    }, 2000);
  };

  if (!pause) {
    try {
      await currentSong.play();
      console.log("Playback started successfully");
    } catch (err) {
      console.log("Playback requires user interaction:", err.message);
      // Don't show error here - user just needs to click play button
    }
  }
  
  updatePlayingState();
}

// Update playing state
function updatePlayingState() {
  if (!elements.songList) return;
  
  elements.songList.querySelectorAll("li").forEach((li, index) => {
    if (songs[index] && songs[index].name === currentTrack) {
      li.classList.add("playing");
      if (li.querySelector(".playnow span")) {
        li.querySelector(".playnow span").textContent = currentSong.paused ? "Play Now" : "Now Playing";
      }
      if (li.querySelector(".playnow img")) {
        li.querySelector(".playnow img").src = currentSong.paused ? "play.svg" : "pause.svg";
      }
    } else {
      li.classList.remove("playing");
      if (li.querySelector(".playnow span")) {
        li.querySelector(".playnow span").textContent = "Play Now";
      }
      if (li.querySelector(".playnow img")) {
        li.querySelector(".playnow img").src = "play.svg";
      }
    }
  });
}

// Show error
function showError(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff3b30;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1000;
    font-family: Arial, sans-serif;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Create folder cards
async function createCards() {
  const cardContainer = elements.cardContainer;
  
  if (!cardContainer) {
    console.error("cardContainer not found");
    return;
  }
  
  if (allFolders.length === 0) {
    cardContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <h3>No music folders found</h3>
        <p>Please create a 'songs' folder with subfolders:</p>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; text-align: left; display: inline-block;">
songs/
├── Folder1/
│   ├── cover.jpg
│   └── audio-file.mp3
├── Folder2/
│   ├── cover.jpg
│   └── audio-file.mp3
└── folder3/
    ├── cover.jpg
    └── audio-file.mp3</pre>
        <button id="retryScan" style="margin-top: 20px; padding: 10px 20px; background: #1db954; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Retry Scan
        </button>
      </div>
    `;
    
    // Add retry button event
    setTimeout(() => {
      const retryBtn = document.querySelector("#retryScan");
      if (retryBtn) {
        retryBtn.addEventListener("click", async () => {
          await initializePlayer();
        });
      }
    }, 100);
    
    return;
  }
  
  cardContainer.innerHTML = allFolders.map(folder => {
    return `
      <div class="card" data-folder="${folder.name}">
        <div class="play">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <circle cx="12" cy="12" r="10" stroke="black" stroke-width="1.5" />
            <path d="M9.5 11.1998V12.8002C9.5 14.3195 9.5 15.0791 9.95576 15.3862C10.4115 15.6932 11.0348 15.3535 12.2815 14.6741L13.7497 13.8738C15.2499 13.0562 16 12.6474 16 12C16 11.3526 15.2499 10.9438 13.7497 10.1262L12.2815 9.32594C11.0348 8.6465 10.4115 8.30678 9.95576 8.61382C9.5 8.92086 9.5 9.6805 9.5 11.1998Z" fill="black" />
          </svg>
        </div>
        <div class="card-content">
          <img src="${folder.image}" alt="${folder.name}" loading="lazy" class="folder-image" 
               style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px;"
               onerror="this.onerror=null; this.src='https://via.placeholder.com/300/1db954/000000?text=${encodeURIComponent(folder.name)}'">
          <div class="card-text">
            <h2>${folder.name}</h2>
            <p>${folder.description}</p>
            <small>${folder.songCount} track${folder.songCount !== 1 ? 's' : ''}</small>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click event to cards
  cardContainer.addEventListener("click", async (e) => {
    const card = e.target.closest(".card");
    if (card) {
      const folderName = card.dataset.folder;
      
      cardContainer.querySelectorAll(".card").forEach(c => {
        c.classList.remove("active");
      });
      card.classList.add("active");
      
      if (folderName) {
        await getSongs(folderName);
        if (songs.length > 0) {
          // Don't auto-play, just load the first song
          currentTrack = songs[0].name;
          updatePlayingState();
        }
      }
    }
  });
}

// Initialize player
async function initializePlayer() {
  showLoading(true);
  
  try {
    console.log("Initializing music player...");
    
    // Load folder structure
    await loadFolderStructure();
    
    // Create cards UI
    await createCards();
    
    // Load first folder by default
    if (allFolders.length > 0) {
      await getSongs(allFolders[0].name);
      
      const firstCard = elements.cardContainer.querySelector(".card");
      if (firstCard) {
        firstCard.classList.add("active");
      }
      
      if (songs.length > 0) {
        console.log("Ready to play! Click on any song to start.");
      } else {
        console.log("No songs found in folders. Make sure you have audio files.");
      }
    }
    
    console.log("Player initialized successfully!");
  } catch (error) {
    console.error("Error initializing player:", error);
    showError("Failed to initialize player. Check console for details.");
  } finally {
    showLoading(false);
  }
}

// Setup other UI functions
function setupHamburgerMenu() {
  if (!elements.hamburger || !elements.leftPanel) return;
  
  elements.hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.leftPanel.classList.add('active');
    
    if (window.innerWidth <= 1024) {
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.addEventListener('click', () => {
        elements.leftPanel.classList.remove('active');
        overlay.remove();
      });
      document.body.appendChild(overlay);
    }
  });
  
  document.addEventListener('click', (event) => {
    if (!elements.leftPanel.contains(event.target) && 
        !elements.hamburger.contains(event.target)) {
      elements.leftPanel.classList.remove("active");
      document.querySelector('.overlay')?.remove();
    }
  });
}

function setupVolumeControls() {
  if (!elements.volumeSlider || !elements.volumeIcon) return;
  
  currentSong.volume = elements.volumeSlider.value / 100;
  
  elements.volumeSlider.addEventListener("input", (e) => {
    currentSong.volume = e.target.value / 100;
    updateVolumeIcon(e.target.value / 100);
  });
  
  elements.volumeIcon.addEventListener("click", () => {
    if (currentSong.volume > 0) {
      elements.volumeSlider.dataset.previousVolume = elements.volumeSlider.value;
      currentSong.volume = 0;
      elements.volumeSlider.value = 0;
    } else {
      const prevVolume = elements.volumeSlider.dataset.previousVolume || 80;
      currentSong.volume = prevVolume / 100;
      elements.volumeSlider.value = prevVolume;
    }
    updateVolumeIcon(currentSong.volume);
  });
  
  function updateVolumeIcon(volume) {
    if (!elements.volumeIcon) return;
    elements.volumeIcon.style.opacity = volume === 0 ? "0.5" : "1";
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (currentSong.src) {
        if (currentSong.paused) {
          currentSong.play().catch(err => {
            console.log("Playback error:", err);
          });
        } else {
          currentSong.pause();
        }
      }
    } else if (e.code === 'ArrowRight') {
      playNext();
    } else if (e.code === 'ArrowLeft') {
      playPrevious();
    }
  });
}

function playNext() {
  if (songs.length === 0) {
    showError("No songs available");
    return;
  }
  
  if (!currentTrack && songs.length > 0) {
    playMusic(songs[0]);
    return;
  }
  
  const currentIndex = songs.findIndex(s => s.name === currentTrack);
  if (currentIndex === -1 && songs.length > 0) {
    playMusic(songs[0]);
    return;
  }
  
  const nextIndex = (currentIndex + 1) % songs.length;
  playMusic(songs[nextIndex]);
}

function playPrevious() {
  if (songs.length === 0) {
    showError("No songs available");
    return;
  }
  
  if (!currentTrack && songs.length > 0) {
    playMusic(songs[0]);
    return;
  }
  
  const currentIndex = songs.findIndex(s => s.name === currentTrack);
  if (currentIndex === -1 && songs.length > 0) {
    playMusic(songs[0]);
    return;
  }
  
  const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
  playMusic(songs[prevIndex]);
}

// Main function
async function main() {
  console.log("Initializing Music Player...");
  
  // Setup all event listeners
  setupHamburgerMenu();
  setupVolumeControls();
  setupKeyboardShortcuts();
  
  // Setup player controls
  if (elements.playBtn) {
    elements.playBtn.addEventListener("click", () => {
      if (!currentSong.src) {
        if (songs.length > 0) {
          playMusic(songs[0]);
        } else {
          showError("No song selected");
        }
        return;
      }
      
      if (currentSong.paused) {
        currentSong.play().catch(err => {
          console.log("Playback error:", err);
          showError("Could not play audio");
        });
      } else {
        currentSong.pause();
      }
    });
  }
  
  if (elements.nextBtn) {
    elements.nextBtn.addEventListener("click", playNext);
  }
  
  if (elements.previousBtn) {
    elements.previousBtn.addEventListener("click", playPrevious);
  }
  
  // Setup seekbar
  if (elements.seekbar) {
    elements.seekbar.addEventListener("click", (e) => {
      if (!currentSong.src || isNaN(currentSong.duration)) return;
      
      const rect = elements.seekbar.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      
      currentSong.currentTime = percentage * currentSong.duration;
      
      if (elements.seekCircle) {
        elements.seekCircle.style.left = `${percentage * 100}%`;
      }
    });
  }
  
  // Initialize player
  await initializePlayer();
  
  console.log("Music Player ready!");
}

// Start app
document.addEventListener("DOMContentLoaded", main);

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .songList li.playing {
    background-color: rgba(29, 185, 84, 0.1);
    border-left: 4px solid #1db954;
  }
  
  .songList li.playing .info div:first-child {
    color: #1db954;
    font-weight: 600;
  }
  
  .card.active {
    border: 2px solid #1db954;
    box-shadow: 0 0 0 1px #1db954;
  }
  
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
  
  @media (max-width: 1024px) {
    .left.active {
      transform: translateX(0);
      z-index: 1000;
    }
  }
`;
document.head.appendChild(style);