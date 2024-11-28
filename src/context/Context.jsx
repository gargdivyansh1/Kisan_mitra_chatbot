import { createContext, useState } from "react";
import run from "../config/gemini";
//import { resolveConfig } from "vite";

export const Context = createContext();

const ContextProvider = (props) => {

    const [input , setInput] = useState("");
    const [recentPrompt , setRecentPrompt] = useState("");
    const [previousPrompt , setPreviousPrompt] = useState([]);
    const [showResult , setShowResult] = useState(false);
    const [loading ,setLoading] = useState(false);
    const [resultData , setResultData] = useState("");

    const delaypara = (index , nextWord) => {
        setTimeout(function() {
            setResultData(prev => prev+nextWord);
        } , 75*index)
    }

    const newChat = () => {
        setLoading(false)
        setShowResult(false)
    }

    const onSent = async (prompt) => {
        setResultData("")
        setLoading(true)
        setShowResult(true)
        let response ;
        if(prompt !== undefined){
            response = await run(prompt);
            setRecentPrompt(prompt)
        } else {
            setPreviousPrompt(prev => [...prev , input])
            setRecentPrompt(input)
            response = await run(input)
        }
        // setRecentPrompt(input)
        // setPreviousPrompt(prev => [...prev , input])
        // const response = await run(input)

        let responseArray = response.split("**");
        let newArray = "" ;
        for(let i = 0 ; i < responseArray.length ; i++){
            if(i === 0 || i % 2 !== 1){
                newArray += responseArray[i];
            } else {
                newArray += "<b>"+responseArray[i]+"</b>";
            }
        }

        let newResponse2 = newArray.split("*").join("</br>");

        //now for the typing effect 
        // we will use the new array and store every word in a index 
        // and then display each word one by one 
        // not this     setResultData(newResponse2)
        let newResponseArray = newResponse2.split(" ");
        for(let i = 0 ; i < newResponseArray.length ; i++){
            const nextWord = newResponseArray[i];
            delaypara(i , nextWord+" ");
        }
        setLoading(false)
        setInput("")
    }

    //onSent("What is react JS")

    const conextValue = {
        previousPrompt,
        setPreviousPrompt,
        onSent,
        setRecentPrompt,
        recentPrompt,
        showResult,
        loading,
        resultData,
        input,
        setInput,
        newChat 
    }

    return (
        <Context.Provider value={conextValue}>
            {props.children}
        </Context.Provider>
    )
}

export default ContextProvider