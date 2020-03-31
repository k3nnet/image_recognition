import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { VideoComponent } from './video/video.component'
import{ImageComponentComponent} from './image-component/image-component.component'


const routes: Routes = [
  { path: 'image', component: ImageComponentComponent },
  { path: 'video', component: VideoComponent },
  { path: '',
  redirectTo: '/image',
  pathMatch: 'full'
}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
