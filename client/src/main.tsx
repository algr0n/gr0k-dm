import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./components/character-sheet/CharacterSheet.css";

createRoot(document.getElementById("root")!).render(<App />);
