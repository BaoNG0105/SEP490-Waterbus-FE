import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
import { NotFound } from "./pages/NotFound";

import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

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
import { VesselManagement, CreateVessel, EditVessel } from "./pages/Admin/VesselManagement";

function App() {
  return (
    <Router>
      <Routes>
        {/* ============= Client Page ============= */}
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

        {/* Waterbus Booking Page */}
        <Route
          path="/waterbus-booking"
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


        {/*============= Admin Page ============= */}
        <Route element={<AdminProtectedRoute />}>
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
              <AdminLayout title="Customers Management">
                <CustomerManagement />
              </AdminLayout>
            }
          />

          {/* Admin Vessels Page */}
          <Route
            path="/admin/vessels-management"
            element={
              <AdminLayout title="Vessels Management">
                <VesselManagement />
              </AdminLayout>
            }
          />

          {/* Create Vessel Page */}
          <Route
            path="/admin/vessels-management/create"
            element={
              <AdminLayout title="Create Vessel">
                <CreateVessel />
              </AdminLayout>
            }
          />

          {/* Edit Vessel Page */}
          <Route path="/admin/vessels-management/edit/:id"
            element={
              <AdminLayout title="Edit Vessel">
                <EditVessel />
              </AdminLayout>
            }
          />
        </Route>

        {/* THÊM ROUTE 404 Ở DƯỚI CÙNG */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Router>
  );
}

export default App;
