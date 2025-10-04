import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-chat-box',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  template: `
  <div class="chat">
    <div class="msgs">
      <div *ngFor="let m of messages" class="msg" [class.me]="m.role==='user'">
        <b *ngIf="m.role==='user'">You:</b><b *ngIf="m.role==='bot'">Guide:</b> {{ m.text }}
      </div>
    </div>
    <form (ngSubmit)="send()" class="row">
      <ion-input [(ngModel)]="draft" name="draft" placeholder="Ask e.g. 'week of May 12' or 'Jun–Sep'"></ion-input>
      <ion-button type="submit">Send</ion-button>
    </form>
  </div>`,
  styles: [`
    .chat { display:flex; flex-direction:column; gap:8px; }
    .msgs { max-height: 220px; overflow:auto; padding-right:4px; }
    .msg { margin:4px 0; }
    .msg.me { text-align:right; }
    form.row { display:flex; gap:8px; align-items:center; }
  `]
})
export class ChatBoxComponent {
  @Input() messages: {role:'user'|'bot', text:string}[] = [];
  @Output() message = new EventEmitter<string>();
  draft = '';
  send(){ const t=this.draft.trim(); if(!t) return; this.message.emit(t); this.draft=''; }
}
