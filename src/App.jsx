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
import { Booking } from "./pages/Booking";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { CustomerManagement } from "./pages/Admin/CustomerManagement";

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

        {/* Booking Page */}
        <Route
          path="/booking"
          element={
            <MainLayout>
              <Booking />
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
              <Dashboard />
            </AdminLayout>
          }
        />

        {/* Admin Customers Page */}
        <Route
          path="/admin/customers-management"
          element={
            <AdminLayout title="Customer Management">
              <CustomerManagement />
            </AdminLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
