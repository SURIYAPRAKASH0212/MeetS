# MeetS

A minimal, top-tier 1-to-1 video calling application inspired by Google Meet. Made using Node.js, Express, Socket.IO, and vanilla WebRTC.

## Setup Instructions

1. **Install dependencies:**
   Make sure you have Node installed. Navigate to the project directory and run:
   ```bash
   npm install
   ```

2. **Run the server:**
   Start the Node.js server:
   ```bash
   npm start
   ```

3. **Open the app:**
   Go to your browser and access [http://localhost:3000](http://localhost:3000). You can share this URL or open in multiple tabs to mimic two users.
   
   *Note: WebRTC's `getUserMedia` (camera/mic access) requires a secure context. Accessing via `http://localhost` works locally. Over a network, you must serve it over HTTPS or use tools like ngrok.*

## Code Explanation

### 1. WebRTC Flow (Simple Terms)
WebRTC enables Peer-To-Peer video connections. Here is how MeetS handles it:
- **User A** creates a room, waits for another person.
- **User B** joins the room. 
- **Socket.IO** notifies User A that B joined.
- **User A** initiates the WebRTC call by creating an **Offer** (SDP - Session Description Protocol, which is info about its media/data formats) and gives it to the Server.
- Server passes the Offer to **User B**.
- **User B** saves this offer, writes an **Answer** with its own formats, and sends it via Server.
- **User A** receives the Answer.
- Both start exchanging their local network addresses (IP and Ports) known as **ICE Candidates** via the Server.
- Once paths are discovered, the WebRTC P2P connection establishes and video plays!

### 2. Socket.IO Communication
WebRTC is purely peer-to-peer but the initial data (Offer/Answer/ICE) needs a messenger to carry it back and forth. Socket.IO serves as this signaling server. It manages "Rooms" where users join via a `roomId` and broadcasts messages within a specific room.

### 3. Audio / Video Streaming
The browser's native API, `navigator.mediaDevices.getUserMedia()`, captures the raw feed from the user's Mic and Camera. We add the retrieved `localStream` tracks to the `RTCPeerConnection`. Once connected to the peer, the connection returns a `remoteStream` event, which is assigned to the `srcObject` of the remote `<video>` HTML element.
