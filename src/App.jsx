import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
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
// import { Station } from "./pages/Station";
import { StationDetail } from "./pages/Station/StationDetail";
import { Promotions } from "./pages/Promotions";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/Profile/EditProfie";
import { ChangePassword } from "./pages/Profile/ChangePassword";
import { ProfileCharterBookingDetail } from "./pages/Profile/CharterBookings/Detail";
import { ProfileCharterBookings } from "./pages/Profile/CharterBookings";
import { Booking } from "./pages/Booking";
import { CharterBookingPage } from "./pages/CharterBooking";
import { PaymentResult } from "./pages/PaymentResult";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { CustomerManagement } from "./pages/Admin/CustomerManagement";
import { BoatManagement, CreateBoat, EditBoat, SeatLayoutEditor } from "./pages/Admin/BoatManagement";
import { StationManagement } from "./pages/Admin/StationManagement";
import { EditStation } from "./pages/Admin/StationManagement/EditStation";
import { Waterway } from "./pages/Admin/RouteManagement/Waterway";
import { CharterBooking } from "./pages/Admin/CharterBooking";

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

        {/* Profile Charter Booking Requests */}
        <Route
          path="/profile/charter-bookings"
          element={
            <MainLayout>
              <ProfileCharterBookings />
            </MainLayout>
          }
        />

        {/* Profile Charter Booking Detail */}
        <Route
          path="/profile/charter-bookings/:id"
          element={
            <MainLayout>
              <ProfileCharterBookingDetail />
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

        {/* Charter Booking Page */}
        <Route
          path="/charter-booking"
          element={
            <MainLayout>
              <CharterBookingPage />
            </MainLayout>
          }
        />

        {/* PayOS Payment Result */}
        <Route
          path="/payment/success"
          element={
            <MainLayout>
              <PaymentResult />
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

          {/* Admin Boats Page */}
          <Route
            path="/admin/boats-management"
            element={
              <AdminLayout title="Boats Management">
                <BoatManagement />
              </AdminLayout>
            }
          />

          {/* Create Boat Page */}
          <Route
            path="/admin/boats-management/create"
            element={
              <AdminLayout title="Create Boat">
                <CreateBoat />
              </AdminLayout>
            }
          />

          {/* Seat Layout Editor Page */}
          <Route
            path="/admin/boats-management/seats/:id"
            element={
              <AdminLayout title="Seat Layout Editor">
                <SeatLayoutEditor />
              </AdminLayout>
            }
          />

          {/* Edit Boat Page */}
          <Route path="/admin/boats-management/edit/:id"
            element={
              <AdminLayout title="Edit Boat">
                <EditBoat />
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

          {/* Charter Booking Page */}
          <Route
            path="/admin/charter-bookings"
            element={
              <AdminLayout title="Charter Booking">
                <CharterBooking />
              </AdminLayout>
            }
          />
          <Route path="/admin/tours" element={<Navigate to="/admin/charter-bookings" replace />} />
        </Route>

        {/* TRANG BÁO LỖI 404 */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Router>
  );
}

export default App;
