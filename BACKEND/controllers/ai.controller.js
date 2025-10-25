import { generateResult } from "../services/ai.service.js";

export const getResult = async (req, res) => {
  try {
    const { prompt } = req.query;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        message: "Prompt is required" 
      });
    }

    const result = await generateResult(prompt);
    
    res.status(200).json({ 
      success: true, 
      result 
    });
    
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate AI response" 
    });
  }
};