import logo from './logo.svg';
import './App.css';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useAI } from './lib/ai';
import { useEffect, useRef, useState } from 'react';

function App() {
  const { browserSupportsSpeechRecognition, listening, transcript } = useSpeechRecognition();

  const [command, setCommand] = useState('');

  useEffect(() => {
    setCommand(listening ? '' : transcript);
  }, [listening, transcript]);


  const { assistant, messageObjectUrl, messageText } = useAI({ command: command, voice: 'echo' });

  // play audio
  let audio = useRef();
  useEffect(() => {
    if (messageObjectUrl) {
      audio.current = new Audio(messageObjectUrl);
      audio.current.play();
      console.log('playing');
    }

    return () => {
      if (audio.current) {
        audio.current.pause();
        audio.current = null;
      }
    }
  }, [messageObjectUrl])

  // when listening, need to pause audio
  useEffect(() => {
    if (listening && audio) {
      if (audio.current) {
        audio.current.pause();
      }
    }
  }, [listening]);

  if (!assistant) {
    return <span>No Assistant Available</span>;
  }

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn't support speech recognition.</span>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Is Listening: {listening ? 'true' : 'false'}</p>
        {!listening && (
          <button onClick={SpeechRecognition.startListening}>Listen</button>
        )}
        <label>Command:</label>
        <p>{transcript}</p>
        <label>Answer:</label>
        <p>{messageText}</p>
      </header>
    </div>
  );
}

export default App;
