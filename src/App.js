import './App.css';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useAI } from './lib/ai';
import { useEffect, useRef, useState } from 'react';
import md from 'markdown-it';

function App() {
  const markdown = md();
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
    <>
      <div className="voice-chat-container">
        
        <div className="ai-face"></div>

        <div className="button-container">
          <label className="button p-2 px-4 rounded-full cursor-pointer" onClick={SpeechRecognition.startListening}>{listening ? 'Listening' : 'Listen'}</label>
        </div>

        <div className="command-section">
          <label className="block text-gray-700">Command:</label>
          <input
            type="text"
            name="command"
            className="w-full p-2 mt-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300"
            defaultValue={transcript}
            readOnly
          />
        </div>

        <div className="response-section">
          <p className="text-gray-800">AI Response:</p>
          <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: markdown.render(messageText) }}></p>
        </div>

      </div>
    </>

  );
}

export default App;
