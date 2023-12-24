import OpenAI from "openai"
import { useEffect, useState, useRef } from "react";
import functions from "./functions";

export const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

export const useAI = ({ command = '', voice = 'echo' }) => {
    const [state, setState] = useState({
        assistant: null,
        thread: null,
        run: null,
        runIsComplete: false,
        countOfRefreshRun: 0,
        messages: null,
        message: null,
        messageText: '',
        messageBlob: null,
        messageObjectUrl: null
    })
    const { assistant, thread, run, countOfRefreshRun, messages, message, messageText, runIsComplete } = state

    // 1. prepare assistant
    const didAssistant = useRef(false)
    useEffect(() => {
        if (!didAssistant.current) {
            didAssistant.current = true
            openai.beta.assistants.list().then((r) => {
                setState((s) => {
                    return { ...s, assistant: r.data[0] || null }
                })
            })
        }
    }, [])

    // 2. use thread and create if not exists
    const didThread = useRef(false)
    useEffect(() => {
        if (assistant && !didThread.current) {
            didThread.current = true
            openai.beta.threads.create().then((th) => setState((prevState) => ({ ...prevState, thread: th })));
        }
    }, [assistant])

    // 3. thread and assistant are ready
    useEffect(() => {
        if (thread && assistant && !!command) {
            // make message
            openai.beta.threads.messages.create(
                thread.id,
                {
                    role: 'user',
                    content: command,
                }
            ).then((r) => {
                // initially run is null
                setState((prevState) => ({ ...prevState, run: null, runIsComplete: false }));

                // and run it
                openai.beta.threads.runs.create(
                    thread.id,
                    {
                        assistant_id: assistant.id,
                    }
                ).then((r) => {

                    // get the run data
                    setState((prevState) => ({ ...prevState, run: r }));
                });
            });
        }
    }, [thread, assistant, command])

    // 4. get status of run
    useEffect(() => {
        let timeout = null
        if (thread && run) {
            openai.beta.threads.runs.retrieve(thread.id, run.id)
                .then((r) => {
                    if (r.status === 'completed') {
                        setState((prevState) => ({ ...prevState, runIsComplete: true }));
                    } else if (r.status === 'requires_action') {
                        // do nothing
                        const tool = r.required_action?.submit_tool_outputs?.tool_calls?.[0] || null;
                        const args = JSON.parse(tool?.function?.arguments || '{}');
                        const methodName = tool?.function?.name || '';
                        const toolCallId = tool?.id || null;
                        if (methodName) {
                            // TODO: need bulk submit tool outputs
                            functions[methodName]?.apply(null, [args]).then((r) => {
                                const output = {
                                    tool_call_id: toolCallId,
                                    output: r
                                }
                                openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                                    tool_outputs: [output]
                                }).finally((r) => {
                                    timeout = setTimeout(() => {
                                        setState((prevState) => ({ ...prevState, countOfRefreshRun: countOfRefreshRun + 1 }));
                                    }, 1000)
                                })
                            });
                        }
                    } else {
                        timeout = setTimeout(() => {
                            setState((prevState) => ({ ...prevState, countOfRefreshRun: countOfRefreshRun + 1 }));
                        }, 1000)
                    }
                }).catch((e) => {
                    setState((prevState) => ({ ...prevState, runIsComplete: false }));
                })
        }

        return () => {
            if (timeout) {
                clearTimeout(timeout);
            }
        }
    }, [thread, run, countOfRefreshRun])

    // 5. if run status true, then get the list messages
    useEffect(() => {
        if (thread && run && runIsComplete) {
            openai.beta.threads.messages.list(thread.id).then((r) => {
                setState((prevState) => ({ ...prevState, messages: r }));
            })
        }
    }, [thread, run, runIsComplete])

    // 6. set last messages
    useEffect(() => {
        if (messages) {
            setState((prevState) => ({ ...prevState, message: messages?.data[0] || null }));
        }
    }, [messages])

    // 7. set last message text
    useEffect(() => {
        if (message) {
            setState((prevState) => ({ ...prevState, messageText: message?.content[0]?.text?.value || '' }))
        }
    }, [message])

    // 8. turn into blob audio
    useEffect(() => {
        if (messageText && voice) {
            openai.audio.speech.create({
                model: "tts-1",
                voice: voice,
                input: messageText
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
                    setState((prevState) => ({ ...prevState, messageBlob: blob, messageObjectUrl: url }));
                })
        }
    }, [messageText, voice])

    return state
}