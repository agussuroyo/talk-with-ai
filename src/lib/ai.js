import OpenAI from "openai"
import { useEffect, useState } from "react";

export const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

export const useAssistant = (callback = (assistant) => {} , listen = []) => {
    return useEffect(() => {
        openai.beta.assistants.list().then((r) => {
            callback(r.data[0] || null)
        })
    }, listen)
}