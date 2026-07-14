import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
import { NotFound } from "./pages/NotFound";

import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

//Client
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { BlogList } from "./pages/Blog";
import { BlogDetail } from "./pages/Blog/BlogDetail";
// import { Station } from "./pages/Station";
import { StationDetail } from "./pages/Station/StationDetail";
import { Promotions } from "./pages/Promotions";
import { Contact } from "./pages/Contact";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/Profile/EditProfie";
import { ChangePassword } from "./pages/Profile/ChangePassword";
import { CharterDetail } from "./pages/Profile/MyCharterBooking/MyCharterDetail";
import { EditCharter } from "./pages/Profile/MyCharterBooking/EditCharter";
import { CharterList } from "./pages/Profile/MyCharterBooking";
import { CharterRefund } from "./pages/Profile/MyCharterBooking/CharterRefundRequest";
import { WaterbusBooking } from "./pages/WaterbusBooking";
import { WatersightseeingBooking } from "./pages/WatersightseeingBooking";
import { CharterBooking } from "./pages/CharterBooking";
import { PaymentResult } from "./pages/PaymentResult";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { BoatManagement, CreateBoat, EditBoat, SeatLayoutEditor, BoatCrewSchedule } from "./pages/Admin/BoatManagement";
import { StationManagement } from "./pages/Admin/StationManagement";
import { InsuranceManagement } from "./pages/Admin/InsuranceManagement";
import { EditStation } from "./pages/Admin/StationManagement/EditStation";
import { UserManagement } from "./pages/Admin/UserManagement";
import { CreateUser } from "./pages/Admin/UserManagement/CreateUser";
import { EditUser } from "./pages/Admin/UserManagement/EditUser";
import { Waterway } from "./pages/Admin/RouteManagement/Waterway";
import { RouteManagement } from "./pages/Admin/RouteManagement";
import { RouteDetail } from "./pages/Admin/RouteManagement/RouteDetail";
import { MergeGpsRoutes } from "./pages/Admin/RouteManagement/MergeGpsRoutes";
import { AdminCharterBookingDetail, AdminCharterBookingRefund, CharterBookingManagement } from "./pages/Admin/CharterBookingManagement";
import { PromotionManagement } from "./pages/Admin/PromotionManagement";
import { CreatePromotion } from "./pages/Admin/PromotionManagement/CreatePromotion";
import { EditPromotion } from "./pages/Admin/PromotionManagement/EditPromotion";
import { BlogManagement } from "./pages/Admin/BlogManagement";
import { CreateBlog } from "./pages/Admin/BlogManagement/CreateBlog";
import { EditBlog } from "./pages/Admin/BlogManagement/EditBlog";

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

        {/* Waterbus Booking Page */}
        <Route
          path="/waterbus-booking"
          element={
            <MainLayout>
              <WaterbusBooking />
            </MainLayout>
          }
        />

        {/* Watersightseeing Booking Page */}
        <Route
          path="/watersightseeing-booking"
          element={
            <MainLayout>
              <WatersightseeingBooking />
            </MainLayout>
          }
        />

        {/* Charter Booking Page */}
        <Route
          path="/charter-booking"
          element={
            <MainLayout>
              <CharterBooking />
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

        {/* My Charter Booking List Page */}
        <Route
          path="/profile/my-charter-booking"
          element={
            <MainLayout>
              <CharterList />
            </MainLayout>
          }
        />

        {/* My Charter Booking Edit Page */}
        <Route
          path="/profile/my-charter-booking/edit/:id"
          element={
            <MainLayout>
              <EditCharter />
            </MainLayout>
          }
        />

        {/* My Charter Booking Refund Page */}
        <Route
          path="/profile/my-charter-booking/:id/refund"
          element={
            <MainLayout>
              <CharterRefund />
            </MainLayout>
          }
        />

        {/* My Charter Booking Detail Page */}
        <Route
          path="/profile/my-charter-booking/:id"
          element={
            <MainLayout>
              <CharterDetail />
            </MainLayout>
          }
        />

        {/* Charter Booking Payment Result Page */}
        <Route
          path="/payment/result"
          element={
            <MainLayout>
              <PaymentResult />
            </MainLayout>
          }
        />
        <Route
          path="/payment/success"
          element={
            <MainLayout>
              <PaymentResult />
            </MainLayout>
          }
        />
        <Route
          path="/payment/cancel"
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

        {/* Forgot Password Page */}
        <Route path="/forgot-password" element={<ForgotPassword />} />


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

          {/* ******* User Management Page ******* */}
          <Route
            path="/admin/users-management"
            element={
              <AdminLayout title="User Management">
                <UserManagement />
              </AdminLayout>
            }
          />

          {/* Create User Page */}
          <Route
            path="/admin/users-management/create"
            element={
              <AdminLayout title="Create User">
                <CreateUser />
              </AdminLayout>
            }
          />

          {/* Edit User Page */}
          <Route
            path="/admin/users-management/edit/:id"
            element={
              <AdminLayout title="Edit User">
                <EditUser />
              </AdminLayout>
            }
          />

          {/* ******* Boat Management Page ******* */}
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

          {/* Boat Crew Schedule Page */}
          <Route path="/admin/boats-management/crew/:id"
            element={
              <AdminLayout title="Onboard Staff">
                <BoatCrewSchedule />
              </AdminLayout>
            }
          />

          {/* ******* Station Managment Page ******* */}
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

          {/* ******* Charter Booking Management: List Page ******* */}
          <Route
            path="/admin/charter-bookings-management"
            element={
              <AdminLayout title="Charter Booking Management">
                <CharterBookingManagement />
              </AdminLayout>
            }
          />

          {/* Charter Booking Managment: Detail Page */}
          <Route
            path="/admin/charter-bookings-management/:id"
            element={
              <AdminLayout title="Charter Booking Detail">
                <AdminCharterBookingDetail />
              </AdminLayout>
            }
          />

          {/* Charter Booking Management: Refund Page */}
          <Route
            path="/admin/charter-bookings-management/:id/payments/:paymentId/refund"
            element={
              <AdminLayout title="Refund Payment">
                <AdminCharterBookingRefund />
              </AdminLayout>
            }
          />

          {/* ******* Insurance Packages Management ******* */}
          <Route
            path="/admin/insurance-management"
            element={
              <AdminLayout title="Insurance Packages">
                <InsuranceManagement />
              </AdminLayout>
            }
          />

          {/* Waterways Page : Để test */}
          <Route
            path="/admin/waterways-management"
            element={
              <AdminLayout title="Waterways Management">
                <Waterway />
              </AdminLayout>
            }
          />

          {/* ******* Route Management: List Page ******* */}
          <Route
            path="/admin/routes-management"
            element={
              <AdminLayout title="Route Management">
                <RouteManagement />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/routes-management/merge-gps"
            element={
              <AdminLayout title="Merge GPS Routes">
                <MergeGpsRoutes />
              </AdminLayout>
            }
          />

          {/* Route Management: Detail Page */}
          <Route
            path="/admin/routes-management/:id"
            element={
              <AdminLayout title="Route Detail">
                <RouteDetail />
              </AdminLayout>
            }
          />

          {/* ******* Promotion Management: List Page ******* */}
          <Route
            path="/admin/promotions"
            element={
              <AdminLayout title="Promotion Management">
                <PromotionManagement />
              </AdminLayout>
            }
          />

          {/* Promotion Management: Create Page */}
          <Route
            path="/admin/promotions/create"
            element={
              <AdminLayout title="Create Promotion">
                <CreatePromotion />
              </AdminLayout>
            }
          />

          {/* Promotion Management: Edit Page */}
          <Route
            path="/admin/promotions/edit/:id"
            element={
              <AdminLayout title="Edit Promotion">
                <EditPromotion />
              </AdminLayout>
            }
          />

          {/* ******* Blog Management: List Page ******* */}
          <Route
            path="/admin/news"
            element={
              <AdminLayout title="Blog Management">
                <BlogManagement />
              </AdminLayout>
            }
          />

          {/* Blog Management: Create Page */}
          <Route
            path="/admin/news/create"
            element={
              <AdminLayout title="Create Blog Post">
                <CreateBlog />
              </AdminLayout>
            }
          />

          {/* Blog Management: Edit Page */}
          <Route
            path="/admin/news/edit/:id"
            element={
              <AdminLayout title="Edit Blog Post">
                <EditBlog />
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
