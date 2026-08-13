import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "./layout/Admin/AdminLayout";
import { MainLayout } from "./layout/MainLayout";
import { NotFound } from "./pages/NotFound";
import { ScrollToTop } from "./components/ScrollToTop";

//Phân quyền
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { CustomerOnlyRoute } from "./components/CustomerOnlyRoute";
import { GroundStaffOnlyRoute } from "./components/GroundStaffOnlyRoute";

//Client
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { BlogList } from "./pages/Blog";
import { BlogDetail } from "./pages/Blog/BlogDetail";
import { StationDetail } from "./pages/Station/StationDetail";
import { Promotions } from "./pages/Promotions";
import { PromotionDetail } from "./pages/Promotions/PromotionDetail";
import { Contact } from "./pages/Contact";
import { TermsAndPolicy } from "./pages/TermsAndPolicy";
import { Schedule } from "./pages/Schedule";
import { Profile } from "./pages/Profile";
import { Notifications } from "./pages/Notifications";
import { EditProfile } from "./pages/Profile/EditProfie";
import { ChangePassword } from "./pages/Profile/ChangePassword";
import { CharterDetail } from "./pages/Profile/MyCharterBooking/MyCharterDetail";
import { EditCharter } from "./pages/Profile/MyCharterBooking/EditCharter";
import { CharterList } from "./pages/Profile/MyCharterBooking";
import { CharterRefund } from "./pages/Profile/MyCharterBooking/CharterRefundRequest";
import { BookingListPage } from "./pages/Profile/MyBookings/BookingListPage";
import { MyWaterbusBookingDetail } from "./pages/Profile/MyWaterbusBooking/MyWaterbusBookingDetail";
import { MySightseeingBookingDetail } from "./pages/Profile/MySightseeingBooking/MySightseeingBookingDetail";
import { WaterbusBooking } from "./pages/WaterbusBooking";
import { WatersightseeingBooking } from "./pages/WatersightseeingBooking";
import { CharterBooking } from "./pages/CharterBooking";
import { PaymentResult } from "./pages/PaymentResult";
//Admin
import { Dashboard } from "./pages/Admin/Dashboard";
import { Revenue } from "./pages/Admin/Revenue";
import { BoatManagement, CreateBoat, EditBoat, SeatLayoutEditor, BoatCrewSchedule } from "./pages/Admin/BoatManagement";
import { TripManagement, CreateTrip, TripDetail } from "./pages/Admin/TripManagement";
import { SeatTypeManagement } from "./pages/Admin/SeatTypeManagement";
import { StationManagement } from "./pages/Admin/StationManagement";
import { InsuranceManagement } from "./pages/Admin/InsuranceManagement";
import { ReviewManagement } from "./pages/Admin/ReviewManagement";
import { CreateStation } from "./pages/Admin/StationManagement/CreateStation";
import { EditStation } from "./pages/Admin/StationManagement/EditStation";
import { LandmarkManagement } from "./pages/Admin/LandmarkManagement";
import { CreateLandmark } from "./pages/Admin/LandmarkManagement/CreateLandmark";
import { EditLandmark } from "./pages/Admin/LandmarkManagement/EditLandmark";
import { UserManagement } from "./pages/Admin/UserManagement";
import { ManagerManagement } from "./pages/Admin/ManagerManagement";
import { CreateManager } from "./pages/Admin/ManagerManagement/CreateManager";
import { EditManager } from "./pages/Admin/ManagerManagement/EditManager";
import { CreateStaff } from "./pages/Admin/StaffManagement/CreateStaff";
import { EditStaff } from "./pages/Admin/StaffManagement/EditStaff";
import { StaffHub } from "./pages/Admin/StaffHub";
import { RouteManagement } from "./pages/Admin/RouteManagement";
import { RouteDetail } from "./pages/Admin/RouteManagement/RouteDetail";
import { MergeGpsRoutes } from "./pages/Admin/RouteManagement/MergeGpsRoutes";
import { LiveOps } from "./pages/Admin/LiveOps";
import { AdminCharterBookingDetail, AdminCharterBookingRefund, CharterBookingManagement } from "./pages/Admin/CharterBookingManagement";
import { PromotionManagement } from "./pages/Admin/PromotionManagement";
import { CreatePromotion } from "./pages/Admin/PromotionManagement/CreatePromotion";
import { EditPromotion } from "./pages/Admin/PromotionManagement/EditPromotion";
import { ViewPromotion } from "./pages/Admin/PromotionManagement/ViewPromotion";
import { BookingPOS } from "./pages/Admin/BookingPOS";
import { StaffTicketScanPage } from "./pages/Admin/StaffTicketScan";
import { StaffMyTripsPage } from "./pages/Admin/StaffMyTrips";
import { StaffScanHistoryPage } from "./pages/Admin/StaffScanHistory";
import { OperationsSchedulePage } from "./pages/Admin/OperationsSchedule";
import { TripSeatBoardPage } from "./pages/Admin/TripSeatBoard";
import { BlogManagement } from "./pages/Admin/BlogManagement";
import { CreateBlog } from "./pages/Admin/BlogManagement/CreateBlog";
import { EditBlog } from "./pages/Admin/BlogManagement/EditBlog";
import { SystemDataManagement } from "./pages/Admin/SystemDataManagement";
import { CreateSystemData } from "./pages/Admin/SystemDataManagement/CreateSystemData";
import { EditSystemData } from "./pages/Admin/SystemDataManagement/EditSystemData";

function App() {
  return (
    <Router>
      <ScrollToTop />
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

        {/* Promotion Detail Page */}
        <Route
          path="/promotions/:code"
          element={
            <MainLayout>
              <PromotionDetail />
            </MainLayout>
          }
        />

        {/* Lịch khởi hành (customer)*/}
        <Route
          path="/schedule"
          element={
            <MainLayout>
              <Schedule />
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

        {/* Terms & Policy Page (public) */}
        <Route
          path="/terms-and-policy"
          element={
            <MainLayout>
              <TermsAndPolicy />
            </MainLayout>
          }
        />

        {/* Các trang đặt vé: chỉ dành cho Khách hàng, chặn Admin/Staff/Manager */}
        <Route element={<CustomerOnlyRoute />}>
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
        </Route>

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

        {/* Notifications Page */}
        <Route
          path="/notifications"
          element={
            <MainLayout>
              <Notifications />
            </MainLayout>
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

        {/* My Bookings List Page — gộp chung Waterbus + Sightseeing, phân loại bằng tab */}
        <Route
          path="/profile/my-bookings"
          element={
            <MainLayout>
              <BookingListPage />
            </MainLayout>
          }
        />

        {/* My Waterbus Booking Detail Page */}
        <Route
          path="/profile/my-waterbus-booking/:id"
          element={
            <MainLayout>
              <MyWaterbusBookingDetail />
            </MainLayout>
          }
        />

        {/* My Sightseeing Booking Detail Page */}
        <Route
          path="/profile/my-sightseeing-booking/:id"
          element={
            <MainLayout>
              <MySightseeingBookingDetail />
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

          {/* ******* Revenue Report Page ******* */}
          <Route
            path="/admin/revenue"
            element={
              <AdminLayout title="Revenue">
                <Revenue />
              </AdminLayout>
            }
          />

          {/* ******* Customer Management Page ******* */}
          <Route
            path="/admin/users-management"
            element={
              <AdminLayout title="Customer Management">
                <UserManagement />
              </AdminLayout>
            }
          />

          {/* ******* Manager Management Page ******* */}
          <Route
            path="/admin/managers-management"
            element={
              <AdminLayout title="Manager Management">
                <ManagerManagement />
              </AdminLayout>
            }
          />

          {/* Create Manager Page */}
          <Route
            path="/admin/managers-management/create"
            element={
              <AdminLayout title="Create Manager">
                <CreateManager />
              </AdminLayout>
            }
          />

          {/* Edit Manager Page */}
          <Route
            path="/admin/managers-management/edit/:id"
            element={
              <AdminLayout title="Edit Manager">
                <EditManager />
              </AdminLayout>
            }
          />

          {/* ******* Staff Management Page (accounts + assignments) ******* */}
          <Route
            path="/admin/staffs-management"
            element={
              <AdminLayout title="Staff Management">
                <StaffHub />
              </AdminLayout>
            }
          />

          {/* Create Staff Page */}
          <Route
            path="/admin/staffs-management/create"
            element={
              <AdminLayout title="Create Staff">
                <CreateStaff />
              </AdminLayout>
            }
          />

          {/* Edit Staff Page */}
          <Route
            path="/admin/staffs-management/edit/:id"
            element={
              <AdminLayout title="Edit Staff">
                <EditStaff />
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

          <Route
            path="/admin/live-tracking"
            element={
              <AdminLayout title="Live Tracking">
                <LiveOps />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/operations-schedule"
            element={
              <AdminLayout title="Operations Schedule">
                <OperationsSchedulePage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/trips/:tripId/seat-board"
            element={
              <AdminLayout title="Trip Seat Board">
                <TripSeatBoardPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/incidents"
            element={<Navigate to="/admin/live-tracking?view=incidents" replace />}
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

          {/* ******* Trip Management Page ******* */}
          <Route
            path="/admin/trips-management"
            element={
              <AdminLayout title="Trip Management">
                <TripManagement />
              </AdminLayout>
            }
          />

          {/* Create Trip Page */}
          <Route
            path="/admin/trips-management/create"
            element={
              <AdminLayout title="Create Trip">
                <CreateTrip />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/trips-management/:id"
            element={
              <AdminLayout title="Trip Detail">
                <TripDetail />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/seat-types"
            element={
              <AdminLayout title="Fare Policy">
                <SeatTypeManagement />
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

          <Route
            path="/admin/stations-management/create"
            element={
              <AdminLayout title="Create Station">
                <CreateStation />
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

          {/* ******* Landmark Managment Page ******* */}
          <Route
            path="/admin/landmarks-management"
            element={
              <AdminLayout title="Landmarks Management">
                <LandmarkManagement />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/landmarks-management/create"
            element={
              <AdminLayout title="Create Landmark">
                <CreateLandmark />
              </AdminLayout>
            }
          />

          {/* Edit Landmark Page */}
          <Route
            path="/admin/landmarks-management/edit/:id"
            element={
              <AdminLayout title="Edit Landmark">
                <EditLandmark />
              </AdminLayout>
            }
          />

          {/* ******* Charter Booking Management: List Page ******* */}
          <Route
            path="/admin/charter-bookings-management"
            element={
              <AdminLayout title="Request Booking Management">
                <CharterBookingManagement />
              </AdminLayout>
            }
          />

          {/* Charter Booking Managment: Detail Page */}
          <Route
            path="/admin/charter-bookings-management/:id"
            element={
              <AdminLayout title="Request Booking Detail">
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

          {/* ******* Review Management ******* */}
          <Route
            path="/admin/reviews-management"
            element={
              <AdminLayout title="Review Management">
                <ReviewManagement />
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

          {/* Promotion Management: View Page */}
          <Route
            path="/admin/promotions/view/:id"
            element={
              <AdminLayout title="View Promotion">
                <ViewPromotion />
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

          {/* ******* Staff Assignment → gộp vào Nhân viên ******* */}
          <Route
            path="/admin/staff-assignments"
            element={<Navigate to="/admin/staffs-management?view=assignments" replace />}
          />

          <Route
            path="/admin/staff/ticket-scan"
            element={
              <AdminLayout title="Ticket Scan">
                <StaffTicketScanPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/staff/my-trips"
            element={
              <AdminLayout title="My Trips">
                <StaffMyTripsPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/staff/scan-history"
            element={
              <AdminLayout title="Scan History">
                <StaffScanHistoryPage />
              </AdminLayout>
            }
          />

          {/* ******* Booking POS: quầy bán vé Waterbus/Sightseeing tại chỗ *******
              Chỉ Admin/Manager/Staff mặt đất (Ground) được dùng — Staff trên tàu (OnBoard) bị chặn. */}
          <Route element={<GroundStaffOnlyRoute />}>
            <Route
              path="/admin/booking-pos"
              element={
                <AdminLayout title="Ticket POS">
                  <BookingPOS />
                </AdminLayout>
              }
            />
          </Route>

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

          {/* ******* System Data Management: nguồn dữ liệu chatbot + trang Điều khoản & Chính sách ******* */}
          <Route
            path="/admin/knowledge-entries"
            element={
              <AdminLayout title="AI Knowledge Management">
                <SystemDataManagement />
              </AdminLayout>
            }
          />

          <Route
            path="/admin/system-data"
            element={
              <AdminLayout title={{ vn: "Quản lý dữ liệu hệ thống", en: "System Data Management" }}>
                <SystemDataManagement />
              </AdminLayout>
            }
          />

          {/* System Data Management: Create Page */}
          <Route
            path="/admin/system-data/create"
            element={
              <AdminLayout title="New System Data Entry">
                <CreateSystemData />
              </AdminLayout>
            }
          />

          {/* System Data Management: Edit Page */}
          <Route
            path="/admin/system-data/edit/:id"
            element={
              <AdminLayout title="Edit System Data Entry">
                <EditSystemData />
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
