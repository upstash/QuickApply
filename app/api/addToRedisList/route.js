// pages/api/addToRedisList.ts
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis'
import dotenv from 'dotenv';
import { StringOutputParser } from "@langchain/core/output_parsers";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { readFile } from 'node:fs/promises';
import { Document } from "@langchain/core/documents";
//import { formatDocumentsAsString } from "langchain/util/document";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { UpstashRedisChatMessageHistory } from "langchain/stores/message/upstash_redis";
import { Index } from "@upstash/vector";
import { uploader } from "./upload_to_sheets.js";
import { google } from 'googleapis';
dotenv.config();

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
    credentials: {
        private_key: process.env.GOOGLE_PRIVATE_KEY,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
    },
});

const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});
const chatModel = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    temperature: 0.2,
    openAIApiKey: process.env.OPEN_AI_API_KEY,
});
const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPEN_AI_API_KEY,
});


const readjson = async () => {
    const drive = google.drive({ version: 'v3', auth: auth });

    // Read the file content
    const response = await drive.files.get({
        fileId: process.env.CONFIG_FILE_ID,
        alt: 'media'
    });

    return response.data
    //let data = await readFile(process.cwd() + '/job-config.json', { encoding: 'utf8' });
    //return data;
};
let data = await readjson();
let jsonData = data;
let questions = jsonData.questions;
let documents = jsonData.documents;
let position = jsonData.position;
let morecontext = jsonData["more-context"];
let email = jsonData["hiring-manager-email"];
let welcomemessage = jsonData["welcome-message"];
let link = jsonData["position-link"];

async function getRelevantDocuments(question) {
    const vector = await embeddings.embedDocuments([question]);

    if (!vector || !vector[0]) {
        return;
    }

    const results = await index.query({
        vector: vector[0],
        includeVectors: false,
        includeMetadata: true,
        topK: 5,
    })

    let contentString = "";
    for (let i = 0; i < results.length; i++) {
        if (results[i].metadata && results[i].metadata.content) {
            contentString += results[i].metadata.content + "\n";
        }
    }
    return contentString;
}


const getretriever = async () => {
    let loaded_documents = []
    for (let i in documents) {
        const loader = new CheerioWebBaseLoader(documents[i]);
        const docs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter();
        const splitDocs = await splitter.splitDocuments(docs);
        loaded_documents.push(...splitDocs);
    }
    loaded_documents.push(new Document({ pageContent: morecontext }));

    const vectorstore = await MemoryVectorStore.fromDocuments(
        loaded_documents,
        embeddings
    );
    let vectors = []
    for (let i = 0; i < vectorstore.memoryVectors.length; i++) {
        let vector = {
            id: Math.random(),
            vector: vectorstore.memoryVectors[i].embedding,
            metadata: { content: vectorstore.memoryVectors[i].content },
        }
        vectors.push(vector);
    }
    await index.upsert(vectors);
};


let memory = null;


const prompt1 = ChatPromptTemplate.fromMessages([
    ["system", `You are a helpful chatbot greet user using ${welcomemessage} and ask user's name and wait for the user to answer. Then ask the user's email and wait for the user to answer. After those ask ${questions} one by one and wait for the user to answer between the questions. Use chat previous chat history to determine which question to ask. If the previous answer does not answer the previous question properly, ask the previous question again. If the all of the questions are answered, ask user to load a cv in pdf format. After that let the user ask questions. Answer the user's questions based only on the provided context and if the answer cannot be determined only using context just say you will send an email to hiring manager and NEVER make up an answer. Be precise and give a short answer. The context:{context}.`],
    new MessagesPlaceholder("history"),
    ["human", `Input:{input}`]
]);

const extractor_prompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("history"),
    ["human", `Extract answers of the questions from the chat history. Output must include the user's name, email and answers to the questions. Each element of the output must be separated by semicolon. Questions:{input}`]
]);
const end_prompt = ChatPromptTemplate.fromMessages([
    ["system", `Using the chat history, output only "YES" if the previous user input indicates that the user does not have any more questions or user says goodbye else output only "NO". Output nothing else.`],
    new MessagesPlaceholder("history"),
    ["human", `{input}`]
]);
const unanswered_questions_prompt = ChatPromptTemplate.fromMessages([
    ["system", ``],
    new MessagesPlaceholder("history"),
    ["human", `List questions asked by the user after the user uploaded the CV and AI failed to answer or said it will send an email to the hiring manager. Use chat history to determine the questions and the answers.`]
]);

const cv_question = ChatPromptTemplate.fromMessages([
    ["human", `Does the question asks user to load a cv? Output only YES or NO. The Question is:{question}`]
]);


const chat_chain = RunnableSequence.from([
    {
        input: (i) => i.input,
        memory: () => memory.loadMemoryVariables({}),
        context: (i) => i.context,//retriever1.pipe(formatDocumentsAsString),
    },
    {
        input: (previousOutput) => previousOutput.input,
        history: (previousOutput) => previousOutput.memory.history,
        context: (previousOutput) => previousOutput.context,
    },
    prompt1,
    chatModel,
    new StringOutputParser()
]);

const cv_chain = RunnableSequence.from([
    {
        question: (i) => i,
    },
    cv_question,
    chatModel,
    new StringOutputParser()
]);

const answer_chain = RunnableSequence.from([
    {
        input: (i) => i,
        memory: () => memory.loadMemoryVariables({}),
    },
    {
        input: (previousOutput) => previousOutput.input,
        history: (previousOutput) => previousOutput.memory.history,
    },
    extractor_prompt,
    chatModel,
    new StringOutputParser()
]);

const unanswered_chain = RunnableSequence.from([
    {
        memory: () => memory.loadMemoryVariables({}),
    },
    {
        history: (previousOutput) => previousOutput.memory.history,
    },
    unanswered_questions_prompt,
    chatModel,
    new StringOutputParser()
]);

const end_chain = RunnableSequence.from([
    {
        input: (i) => i.input,
        memory: () => memory.loadMemoryVariables({}),
    },
    {
        history: (previousOutput) => previousOutput.memory.history,
        input: (previousOutput) => previousOutput.input,
    },
    end_prompt,
    chatModel,
    new StringOutputParser()
]);

const ai_function = async (input, channel) => {
    let is_finished = await end_chain.invoke(input);
    let ai_output = await chat_chain.invoke(input);
    await memory.saveContext({
        input: input.input
    }, {
        output: ai_output
    });
    if (is_finished.toLowerCase() === "yes") {
        let unanswered_questions = await unanswered_chain.invoke({});
        let answers = await answer_chain.invoke(questions);
        console.log(unanswered_questions);
        console.log("------------------");
        console.log(answers);
        uploader({ uuid: channel, answers: answers, questions: unanswered_questions, email_receiver: email }
        )
            .then(response => response.json())
            .then(data => console.log(data))
            .catch(error => console.error(error));
    }
    return ai_output;
}


export async function POST(req, res) {
    if (req.method === 'POST') {
        const data = await req.json();
        const text = data.text;
        const channel = data.channel_name;
        if (memory === null) {
            console.log(channel);
            memory = new BufferMemory({
                returnMessages: true,
                chatHistory: new UpstashRedisChatMessageHistory({
                    sessionId: channel,
                    config: {
                        url: process.env.UPSTASH_REDIS_REST_URL,
                        token: process.env.UPSTASH_REDIS_REST_TOKEN,
                    }
                }),
            });
        }
        let context = await getRelevantDocuments(text);
        if (context === "") {
            await getretriever();
            context = await getRelevantDocuments(text);
        }
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        let ai_output = await ai_function({ input: text, context: context }, channel);
        let load_cv = await cv_chain.invoke(ai_output, channel)
        return NextResponse.json({ text: ai_output, loadcv: load_cv });
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}
