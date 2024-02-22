// pages/index.js (or any other frontend component)
'use client';
import { v4 as uuid } from "uuid";
import './globals.css';
// pages/index.js

import { useState, useEffect } from 'react';

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
    function TextBubble(props) {
        const { text, sender } = props.props;

        const bubbleStyle = {
            backgroundColor: sender.toLowerCase() === "user" ? "#007bff" : "white",
            color: sender.toLowerCase() === "user" ? "white" : "black",
            borderRadius: "10px",
            padding: "10px",
            marginBottom: "10px",
        };

        return (
            <div style={bubbleStyle}>
                <h3>{text}</h3>
            </div>
        );
    }

    return (
        <div className="quick-apply-container">
            <h1 className="quick-apply-header">Quick Apply</h1>
            <div className="list-container">
                {listData.map((item, index) => (
                    <TextBubble key={index} props={item}></TextBubble>
                ))}
            </div>
            <div className="form-container">
                {cv_upload ? (
                    <form onSubmit={handlefileSubmit} className="cv-upload-form">
                        <input type="file" onChange={handleFileInputChange} />
                        <button type="submit">Upload CV</button>
                    </form>
                ) : (
                    <form onSubmit={handletextSubmit} className="text-input-form">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Enter your answer..."
                        />
                        <button type="submit">Submit Answer</button>
                    </form>
                )}
            </div>
        </div>
    )
};
