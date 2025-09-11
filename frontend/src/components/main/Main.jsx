import React, { useState, useRef, useMemo, useEffect } from "react";
import { assets } from "../../assets/assets";
import { FaRegPlusSquare } from "react-icons/fa";
import { PiTextAlignJustify } from "react-icons/pi";
import axios from "axios";

const farmer_questions = [
    "इस मौसम में उगाने के लिए सबसे अच्छी फसलें",
    "गेहूं में कीटों से बचाव के तरीके",
    "धान की सिंचाई के सर्वोत्तम तरीके",
    "मिट्टी की जांच कैसे करें?",
    "सब्जियों की उर्वरक की सही मात्रा कितनी होनी चाहिए?",
    "फलदार पौधों की देखभाल के टिप्स",
    "सस्ते और प्रभावी कीट नियंत्रण के उपाय",
    "सूखी मिट्टी में फसल उगाने के तरीके",
    "बुवाई के लिए आदर्श समय कौन सा है?",
    "फसल में पोषण की कमी कैसे पहचानें?",
    "बाजार में फसल बेचने के सर्वोत्तम तरीके",
    "जैविक खाद बनाने के सरल तरीके",
    "खेती में पानी की बचत के उपाय",
    "कृषि मशीनरी का सही इस्तेमाल कैसे करें?",
    "धान की उचित कटाई का समय",
    "फसल के रोगों का जल्दी पता लगाने के संकेत",
    "बीज बोने से पहले मिट्टी की तैयारी कैसे करें?",
    "नमी और तापमान के अनुसार सिंचाई की योजना",
    "जैविक कीट नियंत्रण के प्रभावी तरीके",
    "फसल के लिए उपयुक्त उर्वरक का चुनाव",
    "अनाज की भंडारण और सुरक्षा के तरीके",
    "सूखा या बाढ़ के समय फसल सुरक्षा उपाय",
    "मौसमी फसल विविधता बढ़ाने के सुझाव",
    "कृषि बीमा लेने की प्रक्रिया और लाभ"
];

const Main = () => {
    const user_id = "random_user1";
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [val, setValue] = useState("0")

    const [input, setInput] = useState("");
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(false);

    const [listening, setListening] = useState(false);
    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);

    const randomQuestions = useMemo(() => {
        const shuffled = [...farmer_questions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 4);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversations]);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const sessionIds = await all_session_of_user(user_id);

                if (sessionIds.length > 0) {

                    console.log(sessionIds.length)
                    const formattedSessions = sessionIds.map((sessionId, index) => ({
                        id: sessionId,
                        title: sessionId.replace(`${user_id}_`, ""),
                        active: index === 0
                    }));

                    setSessions(formattedSessions);
                    setActiveSessionId(formattedSessions[0].id);
                } else {
                    const defaultSession = {
                        id: `${user_id}_default`,
                        title: "सामान्य_चर्चा",
                        active: true
                    };
                    setSessions([defaultSession]);
                    setActiveSessionId(defaultSession.id);
                }
            } catch (error) {
                console.error("Error fetching sessions for user:", error);
                const defaultSession = {
                    id: `${user_id}_default`,
                    title: "सामान्य_चर्चा",
                    active: true
                };
                setSessions([defaultSession]);
                setActiveSessionId(defaultSession.id);
            }
        };

        fetchSessions();
    }, [setValue, val]);

    useEffect(() => {
        const fetchConversationHistory = async () => {
            if (activeSessionId) {
                try {
                    const history = await conversation_of_current_session(user_id + "_" + sessions.find(s => s.active)?.title);
                    setConversations(history);
                } catch (error) {
                    console.error("Error fetching conversation history:", error);
                    setConversations([]);
                }
            }
        };

        fetchConversationHistory();
    }, [activeSessionId]);

    const startListening = () => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
            alert("Your browser does not support voice input");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = "hi-IN";
        recognitionRef.current.interimResults = true;
        recognitionRef.current.maxAlternatives = 1;

        recognitionRef.current.onstart = () => {
            setListening(true);
        };

        recognitionRef.current.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
        };

        recognitionRef.current.onend = () => {
            setListening(false);
        };

        recognitionRef.current.start();
    };

    const selectSession = (id) => {
        setActiveSessionId(id);
        setSessions(prevSessions =>
            prevSessions.map(session => ({
                ...session,
                active: session.id === id
            }))
        );
    };

    const createNewSession = async () => {
        try {
            const newSessionId = `${user_id}_session_${Date.now()}`;
            const newSession = {
                id: newSessionId,
                title: "नया_सत्र",
                active: true
            };

            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(newSessionId);
            setConversations([]);

        } catch (error) {
            console.error("Error creating new session:", error);
        }
    };

    function formatMarkdown(text) {
        if (!text) return "";

        let formatted = text;

        formatted = formatted.replace(/^### (.*)$/gm, "<h3 class='font-semibold text-lg mt-2'>$1</h3>");

        formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

        formatted = formatted.replace(/(?:^- .*(?:\n|$))+?/gm, (match) => {
            const items = match
                .trim()
                .split('\n')
                .map(line => line.replace(/^- (.*)$/, "<li class='ml-6 list-disc'>$1</li>"))
                .join('');
            return `<ul>${items}</ul>`;
        });

        return formatted;
    }

    const conversation_of_current_session = async (session_id) => {
        console.log(session_id)
        try {
            const res = await axios.get(`https://kisan-mitra-chatbot-2.onrender.com/farmer_query/session/${session_id}/history`);
            return res.data;
        } catch (err) {
            console.error("Error fetching conversation:", err);
            return [];
        }
    };

    const all_session_of_user = async (user_id) => {
        try {
            const res = await axios.get(`https://kisan-mitra-chatbot-2.onrender.com/farmer_query/allSession_user/${user_id}`);
            return res.data;
        } catch (err) {
            console.error("Error fetching session for the user:", err);
            return [];
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !activeSessionId) return;

        const userMessage = {
            type: "human",
            content: input,
            timestamp: new Date().toISOString()
        };

        setConversations(prev => [...prev, userMessage]);
        setLoading(true);

        let req = sessions.find(s => s.active)?.title

        try {
            const response = await axios.post("https://kisan-mitra-chatbot-2.onrender.com/farmer_query/chat", {
                user_id: user_id,
                message: input,
                session_id: req !== "नया_सत्र"
                    ? `${user_id}_${req}`
                    : `${user_id}_${input}`
            });

            setValue(val + 1);

            const botMessage = {
                type: "bot",
                content: formatMarkdown(response.data.response || "कोई उत्तर उपलब्ध नहीं है।"),
                timestamp: new Date().toISOString()
            };

            setConversations(prev => [...prev, botMessage]);
        } catch (error) {
            console.error("Error calling backend API:", error);

            const errorMessage = {
                type: "bot",
                content: "सर्वर से उत्तर प्राप्त नहीं हो सका।",
                timestamp: new Date().toISOString()
            };

            setConversations(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            setInput("");
        }
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-b from-amber-50 to-emerald-50">
            <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 bg-gradient-to-b from-emerald-800 to-emerald-900 text-white overflow-hidden flex flex-col`}>
                <div className="p-4 flex items-center justify-between border-b border-emerald-700">
                    <h2 className="text-xl font-bold">सत्र</h2>
                    <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-emerald-700">
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    <button
                        onClick={createNewSession}
                        className="flex items-center justify-center gap-2 w-full mt-4 p-3 rounded-lg border border-emerald-500 hover:bg-emerald-700 transition text-white mb-5"
                    >
                        <FaRegPlusSquare /> <span>नया सत्र</span>
                    </button>
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => selectSession(session.id)}
                            className={`p-3 rounded-lg mb-2 cursor-pointer transition ${session.active ? "bg-emerald-600" : "hover:bg-emerald-700"}`}
                        >
                            <p className="text-sm">{session.title}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-screen flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-gradient-to-r from-emerald-800 to-amber-800 text-white shadow-md">
                    <div className="flex items-center">
                        {!sidebarOpen && (
                            <button onClick={() => setSidebarOpen(true)} className="mr-3 p-1 rounded hover:bg-emerald-700">
                                <PiTextAlignJustify size={30} />
                            </button>
                        )}
                        <div className="hidden sm:block">
                            <p className="text-xl sm:text-2xl font-bold tracking-wide font-sans">KisanMitra</p>
                            <p className="text-xs sm:text-sm text-amber-100 mt-1 font-medium">आपका कृषि सहयोगी</p>
                        </div>
                        <div className="sm:hidden">
                            <p className="text-xl font-bold font-sans">KisanMitra</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <img
                            src={assets.user}
                            alt="user"
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-amber-200 shadow-md"
                        />
                    </div>
                </div>

                <div className="flex-1 w-full max-w-4xl mx-auto px-3 py-4 sm:px-4 sm:py-6 md:py-8 no-scrollbar">
                    {conversations.length === 0 ? (
                        <>
                            <div className="my-6 sm:my-8 text-center">
                                <p className="text-2xl sm:text-3xl md:text-5xl font-bold text-emerald-900 leading-snug font-['Merriweather']">
                                    नमस्ते किसान भाई
                                </p>
                                <p className="text-base sm:text-lg text-emerald-700 mt-2 sm:mt-3 font-medium">
                                    मैं आपकी खेती के लिए मार्गदर्शन प्रदान कर सकता हूं
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mt-8 sm:mt-10 md:mt-12">
                                {randomQuestions.map((question, index) => (
                                    <div
                                        key={index}
                                        onClick={() => setInput(question)}
                                        className="bg-gradient-to-br from-amber-50 to-emerald-50 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all cursor-pointer border border-amber-200 hover:-translate-y-1"
                                    >
                                        <div className="flex items-start">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center p-2 mr-3 sm:mr-4">
                                                <img src={assets.compass_icon} alt="question" className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <p className="text-emerald-900 font-medium text-base sm:text-lg leading-tight">
                                                {question}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="mt-6 sm:mt-8 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto space-y-6 sm:space-y-8 no-scrollbar">
                            {conversations.map((message, index) => (
                                message.type === "human" || message.role === "human" ? (
                                    <div key={index} className="flex justify-end">
                                        <div className="bg-amber-100 text-emerald-900 px-4 py-3 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl shadow max-w-[85%] sm:max-w-[80%] border border-amber-200">
                                            <p className="text-emerald-900 font-medium text-sm sm:text-base">{message.content}</p>
                                        </div>
                                        <div className="ml-2 sm:ml-3 flex-shrink-0">
                                            <img src={assets.user} alt="user" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-amber-300 shadow" />
                                        </div>
                                    </div>
                                ) : (
                                    <div key={index} className="flex items-start gap-2 sm:gap-3 md:gap-4">
                                        <div className="flex-shrink-0">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200 shadow">
                                                <img src={assets.gemini_icon} alt="bot" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                                            </div>
                                        </div>
                                        <div className="bg-emerald-50 text-emerald-900 px-4 py-3 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl shadow max-w-[85%] sm:max-w-[80%] border border-emerald-200">
                                            <div className="text-sm sm:text-base leading-relaxed">
                                                {message.content && message.content.startsWith('<') ? (
                                                    <div dangerouslySetInnerHTML={{ __html: message.content }} />
                                                ) : (
                                                    <p>{message.content}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            ))}

                            {loading && (
                                <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200 shadow">
                                            <img src={assets.gemini_icon} alt="bot" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50 text-emerald-900 px-4 py-3 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl shadow max-w-[85%] sm:max-w-[80%] border border-emerald-200">
                                        <div className="space-y-2 sm:space-y-3">
                                            <div className="h-3 sm:h-4 bg-emerald-200/50 rounded-full animate-pulse"></div>
                                            <div className="h-3 sm:h-4 bg-emerald-200/50 rounded-full animate-pulse w-5/6"></div>
                                            <div className="h-3 sm:h-4 bg-emerald-200/50 rounded-full animate-pulse w-4/6"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 mb-6 sm:mb-8 mt-4">
                    <div className="flex items-center justify-between gap-3 sm:gap-4 bg-white shadow-lg rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 border border-amber-300">
                        <input
                            onChange={(e) => setInput(e.target.value)}
                            value={input}
                            type="text"
                            placeholder="अपना प्रश्न यहाँ लिखें..."
                            className="flex-1 bg-transparent border-none outline-none text-emerald-900 text-base sm:text-lg placeholder-emerald-600/70 font-medium font-sans"
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                            <div
                                onClick={startListening}
                                className={`p-2 sm:p-3 rounded-full cursor-pointer transition ${listening ? "bg-emerald-300/50" : "hover:bg-amber-100/50"}`}
                            >
                                <img src={assets.mic_icon} alt="आवाज" className="w-5 sm:w-6 md:w-6 h-5 sm:h-6 md:h-6" />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                className="bg-emerald-700 hover:bg-emerald-800 p-2 sm:p-3 rounded-lg sm:rounded-xl transition shadow-md hover:shadow-lg disabled:opacity-70"
                            >
                                <img src={assets.send_icon} alt="भेजें" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 invert" />
                            </button>
                        </div>
                    </div>
                    <p className="text-xs sm:text-sm text-center text-emerald-700/80 mt-3 sm:mt-4 font-medium px-2">
                        कृपया ध्यान दें: यह चैटबॉट केवल कृषि संबंधित मार्गदर्शन देता है। कृपया अपने क्षेत्रीय कृषि विशेषज्ञ से भी सलाह लें।
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Main;
