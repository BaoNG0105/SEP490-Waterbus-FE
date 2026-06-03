import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
//Client
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Station } from "./pages/Station";
import { Promotions } from "./pages/Promotions";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";
//Admin
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminCustomers } from "./pages/AdminCustomers";

function App() {
  return (
    <Router>
      <Routes>
        {/* Client Page */}
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

        {/* Admin Page */}
        {/* Admin Dashboard Page */}
        <Route
          path="/admin"
          element={
            <AdminLayout title="Dashboard">
              <AdminDashboard />
            </AdminLayout>
          }
        />

        {/* Admin Customers Page */}
        <Route
          path="/admin/customers"
          element={
            <AdminLayout title="Customers">
              <AdminCustomers />
            </AdminLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
