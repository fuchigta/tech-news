import { Rss, Tag } from "lucide-react"
import { Link } from "react-router"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from "~/components/ui/sidebar"

const menus = [
    {
        icon: Rss,
        to: '/',
        title: '人気のRSSエントリ'
    },
    {
        icon: Tag,
        to: 'tags',
        title: '人気のタグ'
    }
]

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {
                                menus.map(item => (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton asChild tooltip={item.title}>
                                            <Link to={item.to}>
                                                <item.icon />
                                                {item.title}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))
                            }
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter />
        </Sidebar>
    )
}
