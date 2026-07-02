import { 
    getPublishedBlogPosts as apiGetPublishedBlogPosts,
    getBlogPostBySlug as apiGetBlogPostBySlug
} from '../api/blogApi';

// Service: Lấy danh sách blog posts đã xuất bản (Status = Published)
export const fetchPublishedBlogPosts = async () => {
    try {
        const data = await apiGetPublishedBlogPosts();
        return data;
    } catch (error) {
        console.error('Lỗi khi lấy danh sách blog posts từ Service:', error);
        throw error;
    }
};

// Service lấy chi tiết bài viết theo Slug
export const fetchBlogPostDetail = async (slug) => {
    try {
        const data = await apiGetBlogPostBySlug(slug);
        return data;
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết blog post với slug: ${slug}`, error);
        throw error;
    }
};