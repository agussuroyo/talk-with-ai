import logo from './logo.svg';
import './App.css';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { openai, useAssistant } from './lib/ai';
import { useEffect, useRef, useState } from 'react';

function App() {
  const { browserSupportsSpeechRecognition, listening, transcript } = useSpeechRecognition();

  const [assistant, setAssistant] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastMessageText, setLastMessageText] = useState('')
  const [promt, setPromt] = useState('');
  const [run, setRun] = useState(null);
  const [runStatus, setRunStatus] = useState(false);
  const [checkProgressCount, setCheckProgressCount] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    if (!listening) {
      setPromt(transcript);
    } else {
      setPromt('');
    }
  }, [listening, transcript])

  // 1. prepare assistant
  useAssistant((assistant) => {
    setAssistant(assistant);
  }, []);

  // 2. use thread and create if not exists
  useEffect(() => {
    if (assistant) {
      openai.beta.threads.create().then((th) => setThread(th));
    }
  }, [assistant])

  // 3. thread and assistant are ready
  useEffect(() => {
    if (thread && assistant && !listening && !!promt) {
      // initially run is null
      setRun(null);
      setRunStatus(false);
      setLastMessageText('');

      // make message
      openai.beta.threads.messages.create(
        thread.id,
        {
          role: 'user',
          content: promt,
        }
      ).then((r) => {
        // and run it
        openai.beta.threads.runs.create(
          thread.id,
          {
            assistant_id: assistant.id,
          }
        ).then((r) => {

          // get the run data
          setRun(r);
        });
      });
    }
  }, [thread, assistant, listening, promt])

  // 4. get status of run
  useEffect(() => {
    let timeout = null
    if (thread && run) {
      openai.beta.threads.runs.retrieve(thread.id, run.id)
        .then((r) => {
          if (r.status === 'completed') {
            setRunStatus(true);
          } else {
            timeout = setTimeout(() => {
              setCheckProgressCount(checkProgressCount + 1);
            }, 1000)
          }
        }).catch((e) => {
          setRunStatus(false);
        })
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }, [thread, run, checkProgressCount])

  // 5. if run status true, then get the list messages
  useEffect(() => {
    if (thread && run && runStatus) {
      openai.beta.threads.messages.list(thread.id).then((r) => {
        // console.log(r);
        setMessages(r);
      })
    }
  }, [thread, run, runStatus])

  // 6. set last messages
  useEffect(() => {
    if (messages) {
      setLastMessage(messages?.data[0] || null);
    }
  }, [messages])

  // 7. set last message text
  useEffect(() => {
    if (lastMessage) {
      setLastMessageText(lastMessage?.content[0]?.text?.value || '');
    }
  }, [lastMessage])

  // 8. turn into audio
  useEffect(() => {
    if (lastMessageText) {
      openai.audio.speech.create({
        model: "tts-1",
        voice: "echo",
        input: lastMessageText
      }).then((r) => {
        const reader = r.body.getReader();
        return new ReadableStream({
          start(controller) {
            return pump();
            function pump() {
              return reader.read().then(({ done, value }) => {
                // When no more data needs to be consumed, close the stream
                if (done) {
                  controller.close();
                  return;
                }
                // Enqueue the next data chunk into our target stream
                controller.enqueue(value);
                return pump();
              });
            }
          },
        });
      })
        // Create a new response out of the stream
        .then((stream) => new Response(stream))
        // Create an object URL for the response
        .then((response) => response.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        })
    }
  }, [lastMessageText])

  // 9. play audio
  let audio = useRef();
  useEffect(() => {
    if (audioUrl) {
      audio.current = new Audio(audioUrl);
      audio.current.play();
      console.log('playing');
    }

    return () => {
      if (audio.current) {
        audio.current.pause();
        audio.current = null;
      }
    }
  }, [audioUrl])

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
        <label>Promt:</label>
        <p>{transcript}</p>
        <label>Answer:</label>
        <p>{lastMessageText}</p>
      </header>
    </div>
  );
}

export default App;
