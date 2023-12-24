import { openai } from "./ai";

export const generateImage = async ({ prompt = '', n = 1, size = '1024x1024'}) => {
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: n,
        size: size,
    });
    return response?.data[0]?.url || null;
}

export default {
    generateImage
}