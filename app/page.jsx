// pages/index.js (or any other frontend component)
'use client';
import { v4 as uuid } from "uuid";
import './globals.css';
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { IconArrowBack } from "@tabler/icons-react";
import { IconUser } from "@tabler/icons-react";
import Markdown from "markdown-to-jsx";
import UpstashLogo from "./upstash-logo";
import PoweredBy from "./powered-by";
// pages/index.js

import { useState, useEffect, useRef } from 'react';



export default function Home() {
    const [inputText, setInputText] = useState('');
    const [listData, setListData] = useState([]);
    const [cv_upload, setCvUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [unique_id, setunique_id] = useState(0);
    const handleFileInputChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    useEffect(() => {
        const fetchData = async () => {
            if (unique_id == 0) {
                try {
                    let id = uuid();
                    setunique_id(id);
                    const response = await fetch('/api/addToRedisList', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ channel_name: id, text: "hello" }),
                    });
                    if (response.ok) {
                        const responseData = await response.json();
                        const textFromResponse = responseData.text;
                        let textFromResponse_obj = { text: textFromResponse, sender: "ai" };
                        setListData([...listData, textFromResponse_obj]);
                        setInputText('');
                    } else {
                        console.error('Failed to add text to Redis list');
                    }
                } catch (error) {
                    console.error('Error submitting form:', error);
                }
            }

        };
        fetchData();
    }, []);



    function cx(...inputs) {
        return twMerge(clsx(inputs));
    }


    const handletextSubmit = async (event) => {
        event.preventDefault();
        let user_input = { text: inputText, sender: "user" };
        setListData([...listData, user_input]);
        let temp_text = inputText;
        setInputText('');
        try {
            const response = await fetch('/api/addToRedisList', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ channel_name: unique_id, text: temp_text }),
            });
            if (response.ok) {
                const responseData = await response.json();
                const textFromResponse = responseData.text;
                const loadcv = responseData.loadcv;
                if (loadcv.toLowerCase() === "yes") {
                    setCvUpload(true);
                } else {
                    setCvUpload(false);
                }
                let textFromResponse_obj = { text: textFromResponse, sender: "ai" };
                setListData([...listData, user_input, textFromResponse_obj]);
            } else {
                console.error('Failed to add text to Redis list');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    const handlefileSubmit = async (event) => {
        try {
            event.preventDefault();
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("uuid", unique_id);
            fetch("/api/upload", {
                method: "POST",
                body: formData,
            })
                .then(response => response.json())
                .then(data => console.log(data))
                .catch(error => console.error(error));
            setCvUpload(false);
            const response = await fetch('/api/addToRedisList', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ channel_name: unique_id, text: "I uploaded the CV." }),
            });
            if (response.ok) {
                const responseData = await response.json();
                const textFromResponse = responseData.text;
                let textFromResponse_obj = { text: textFromResponse, sender: "ai" };
                setListData([...listData, textFromResponse_obj]);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    const listContainerRef = useRef(null);

    useEffect(() => {
        if (listContainerRef.current) {
            listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
        }
    }, [listData]);

    function TextBubble(props) {
        const { text, sender } = props.props;

        /*const bubbleStyle = {
            backgroundColor: sender.toLowerCase() === "user" ? "#007bff" : "white",
            color: sender.toLowerCase() === "user" ? "white" : "black",
            borderRadius: "10px",
            padding: "10px",
            marginBottom: "10px",
        };*/

        const isUser = sender.toLowerCase() === "user";
        const Avatar = ({
            isUser = false
        }) => {
            return (
                <div
                    className={cx(
                        "flex items-center justify-center size-8 shrink-0 rounded-full",
                        isUser ? "bg-gray-200 text-gray-700" : "bg-emerald-950",
                    )}
                >
                    {isUser ? <IconUser size={20} /> : <UpstashLogo />}
                </div>
            );
        };
        return (
            <article
                className={cx(
                    "mb-4 flex items-start gap-4 p-4 md:p-5 rounded-2xl",
                    isUser ? "" : "bg-emerald-50",
                )}
            >
                <Avatar isUser={isUser} />
                <Markdown
                    className={cx(
                        "py-1.5 md:py-1 space-y-4",
                        isUser ? "font-semibold" : "",
                    )}
                    options={{
                        overrides: {
                            ol: ({ children }) => <ol className="list-decimal">{children}</ol>,
                            ul: ({ children }) => <ol className="list-disc">{children}</ol>,
                        },
                    }}
                >
                    {text}
                </Markdown>
            </article>
        );

        /*return (
            <div style={bubbleStyle}>
                <h3>{text}</h3>
            </div>
        );*/
    }

    return (
        <div className="wrapper">
            <div className="quick-apply-container">
                {/*<h1 className="quick-apply-header">Quick Apply</h1>*/}
                <div className="list-container" ref={listContainerRef}>
                    {listData.map((item, index) => (
                        <TextBubble key={index} props={item}></TextBubble>
                    ))}
                </div>
                <div className="form-container flex justify-stretch">
                    {cv_upload ? (
                        <form onSubmit={handlefileSubmit} className="cv-upload-form relative m-auto flex items-center gap-4 justify-center">
                            <input
                                type="file"
                                onChange={handleFileInputChange}
                                className={cx(
                                    "transition h-10 md:h-12 pl-4 pr-12 flex-1 rounded-xl",
                                    "border border-gray-400 text-base",
                                    "disabled:bg-gray-100",
                                )} />
                            <button
                                type="submit"
                                tabIndex={-1}
                                className={cx(
                                    "absolute right-3 top-1/2 -translate-y-1/2",
                                    "opacity-50",
                                )}
                            >
                                <IconArrowBack stroke={1.5} />
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handletextSubmit} className="text-input-form relative m-auto flex items-center gap-4 justify-center">
                            <input
                                required
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Enter your answer..."
                                className={cx(
                                    "transition h-10 md:h-12 pl-4 pr-12 flex-1 rounded-xl",
                                    "border border-gray-400 text-base",
                                    "disabled:bg-gray-100",
                                )}
                            />
                            <button
                                type="submit"
                                tabIndex={-1}
                                className={cx(
                                    "absolute right-3 top-1/2 -translate-y-1/2",
                                    "opacity-50",
                                )}
                            >
                                <IconArrowBack stroke={1.5} />
                            </button>
                        </form>
                    )}
                </div>
                <PoweredBy />
            </div>
        </div>
    )
};


