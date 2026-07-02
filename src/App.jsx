import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
import { NotFound } from "./pages/NotFound";

import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

//Client
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { BlogList } from "./pages/Blog";
import { BlogDetail } from "./pages/Blog/BlogDetail";
import { Station } from "./pages/Station";
import { StationDetail } from "./pages/Station/StationDetail";
import { Promotions } from "./pages/Promotions";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/Profile/EditProfie";
import { ChangePassword } from "./pages/Profile/ChangePassword";
import { Booking } from "./pages/Booking";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { CustomerManagement } from "./pages/Admin/CustomerManagement";
import { VesselManagement, CreateVessel, EditVessel, SeatLayoutEditor } from "./pages/Admin/VesselManagement";
import { StationManagement } from "./pages/Admin/StationManagement";
import { EditStation } from "./pages/Admin/StationManagement/EditStation";
import { Waterway } from "./pages/Admin/RouteManagement/Waterway";

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

        {/* Blogs Page */}
        <Route
          path="/blog"
          element={
            <MainLayout>
              <BlogList />
            </MainLayout>
          }
        />
        {/* Blog Detail Page */}
        <Route
          path="/blog/:slug"
          element={
            <MainLayout>
              <BlogDetail />
            </MainLayout>
          }
        />

        {/* Station Detail Page */}
        <Route
          path="/station/:id"
          element={
            <MainLayout>
              <StationDetail />
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

        {/* Edit Profile Page */}
        <Route
          path="/profile/edit"
          element={
            <MainLayout>
              <EditProfile />
            </MainLayout>
          }
        />

        {/* Change Password Page */}
        <Route
          path="/profile/change-password"
          element={
            <ChangePassword />
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

          {/* Seat Layout Editor Page */}
          <Route
            path="/admin/vessels-management/seats/:vesselId"
            element={
              <AdminLayout title="Seat Layout Editor">
                <SeatLayoutEditor />
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

          {/* Station Managment Page */}
          <Route
            path="/admin/stations-management"
            element={
              <AdminLayout title="Stations Management">
                <StationManagement />
              </AdminLayout>
            }
          />

          {/* Edit Station Page */}
          <Route
            path="/admin/stations-management/edit/:id"
            element={
              <AdminLayout title="Edit Station">
                <EditStation />
              </AdminLayout>
            }
          />

          {/* Waterways Page */}
          <Route
            path="/admin/waterways-management"
            element={
              <AdminLayout title="Waterways Management">
                <Waterway />
              </AdminLayout>
            }
          />
        </Route>

        {/* TRANG BÁO LỖI 404 */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Router>
  );
}

export default App;
