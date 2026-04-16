import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Station } from "./pages/Station";
import { Promotions } from "./pages/Promotions";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";

// Main Layout (Header, Footer)
const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-grow">{children}</div>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Home Page */}
        <Route
          path="/"
          element={
            <MainLayout>
              <Home />
            </MainLayout>
          }
        />

        {/* Station Page */}
        <Route
          path="/stations/:id"
          element={
            <MainLayout>
              <Station />
            </MainLayout>
          }
        />

        {/* Promotions Page */}
        <Route
          path="/promotions"
          element={
            <MainLayout>
              <Promotions />
            </MainLayout>
          }
        />

        {/* Contact Page */}
        <Route
          path="/contact"
          element={
            <MainLayout>
              <Contact />
            </MainLayout>
          }
        />

        {/* Profile Page */}
        <Route
          path="/profile"
          element={
            <MainLayout>
              <Profile />
            </MainLayout>
          }
        />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Register Page */}
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
