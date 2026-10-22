import { GoogleGenAI, Type } from "@google/genai";
import { db } from "../firebaseAdmin";
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from "firebase/firestore";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

export const handleIncomingMessage = async (senderId: string, messageText: string, senderName: string) => {
  // 1. Fetch products for knowledge base
  const productsSnapshot = await getDocs(collection(db, "products"));
  const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 2. Query Gemini
  const prompt = `Customer: ${messageText}. Context: ${JSON.stringify(products)}. 
  If they want to confirm an order, output JSON with CREATE_PENDING_ORDER event, else just reply.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
        systemInstruction: `You are a Vistoosa clothing brand assistant. 
        - Understand Banglish/Bengali.
        - Recommend products based on provided context.
        - Collect: Name, Phone (11 digit), Full Address, Product & Size.
        - Near Dhaka: Savar, Gazipur, Keraniganj, Narayanganj. Delivery charge: Near Dhaka 70, Inside Dhaka 50, Outside Dhaka 120.
        - On confirmation, return JSON: {"event": "CREATE_PENDING_ORDER", "order_details": {...}}`
    }
  });

  const text = response.text || "";
  
  // 3. Check for JSON
  if (text.includes("CREATE_PENDING_ORDER")) {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      const orderJson = JSON.parse(text.substring(jsonStart, jsonEnd));
      
      // Save to orders
      await addDoc(collection(db, "orders"), {
          ...orderJson.order_details,
          status: 'Pending',
          createdAt: new Date().toISOString(),
          customerName: senderName
      });
      return "Order confirmed!";
  }
  
  return text;
};
