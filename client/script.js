const socket = io("/");

// UI Elements
const landingContainer = document.getElementById('landing-container');
const callContainer = document.getElementById('call-container');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const errorMsg = document.getElementById('error-msg');
const roomDisplay = document.getElementById('room-display');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const localNameLabel = document.getElementById('local-name');
const remoteNameLabel = document.getElementById('remote-name');

const micBtn = document.getElementById('mic-btn');
const cameraBtn = document.getElementById('camera-btn');
const endBtn = document.getElementById('end-btn');
const chatToggleBtn = document.getElementById('chat-toggle-btn');

const chatPanel = document.getElementById('chat-panel');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// WebRTC and State
let localStream;
let peerConnection;
let roomId;
let username;
let isVideoOn = true;
let isAudioOn = true;

const servers = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        }
    ]
};

// --- Initialization & UI --- //
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});

roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});

joinBtn.addEventListener('click', async () => {
    username = usernameInput.value.trim();
    roomId = roomInput.value.trim();

    if (!username || !roomId) {
        errorMsg.textContent = 'Please enter both name and room ID';
        return;
    }

    try {
        await startLocalStream();
        landingContainer.classList.add('hidden');
        callContainer.classList.remove('hidden');
        roomDisplay.textContent = `Room: ${roomId}`;
        localNameLabel.textContent = `${username} (You)`;

        socket.emit('join-room', { roomId, username });
        addSystemMessage(`You joined the room.`);
    } catch (error) {
        console.error("Error accessing media devices", error);
        errorMsg.textContent = 'Could not access camera/microphone. Please allow permissions.';
    }
});

async function startLocalStream() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localVideo.muted = true; // prevent local feedback
}

// --- Socket Events --- //
socket.on('room-full', () => {
    alert('Room is full. Max 2 users allowed.');
    window.location.reload();
});

// A new user joined, so WE initiate the call
socket.on('user-joined', async (user) => {
    addSystemMessage(`${user.username} joined the room.`);
    remoteNameLabel.textContent = user.username;
    await makeCall();
});

// We joined a room where someone is already present
socket.on('existing-user', (user) => {
    addSystemMessage(`${user.username} is already in the room.`);
    remoteNameLabel.textContent = user.username;
});

// The other user left
socket.on('user-left', (user) => {
    addSystemMessage(`${user.username} left the room.`);
    remoteVideo.srcObject = null;
    remoteNameLabel.textContent = 'Waiting for someone to join...';
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
});

// Handle incoming WebRTC offer
socket.on('offer', async (data) => {
    if (data.username) remoteNameLabel.textContent = data.username;
    
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { answer, username });
});

// Handle incoming WebRTC answer
socket.on('answer', async (data) => {
    if (data.username) remoteNameLabel.textContent = data.username;
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

// Handle incoming ICE candidate
socket.on('ice-candidate', async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});

// Handle Chat Message
socket.on('chat-message', (data) => {
    appendMessage(data.username, data.message, false);
});

// --- WebRTC Logic --- //
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Listen for remote tracks
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Listen for local ICE candidates to send to peers
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
}

async function makeCall() {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer, username });
}

// --- Control Buttons --- //
micBtn.addEventListener('click', () => {
    isAudioOn = !isAudioOn;
    localStream.getAudioTracks()[0].enabled = isAudioOn;
    micBtn.classList.toggle('muted', !isAudioOn);
});

cameraBtn.addEventListener('click', () => {
    isVideoOn = !isVideoOn;
    localStream.getVideoTracks()[0].enabled = isVideoOn;
    cameraBtn.classList.toggle('muted', !isVideoOn);
});

endBtn.addEventListener('click', () => {
    window.location.reload();
});

// --- Chat Logic --- //
chatToggleBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
});

closeChatBtn.addEventListener('click', () => {
    chatPanel.classList.remove('open');
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = chatInput.value.trim();
    if (text === '') return;

    socket.emit('chat-message', { message: text });
    appendMessage('You', text, true);
    chatInput.value = '';
}

function appendMessage(sender, text, isMine) {
    const div = document.createElement('div');
    div.classList.add('message');
    if (isMine) div.classList.add('my-message');

    div.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-text">${text}</div>
    `;

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.classList.add('system-message');
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
